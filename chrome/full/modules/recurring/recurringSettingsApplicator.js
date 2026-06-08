/**
 * miniCycle Recurring Tasks - Settings Applicator
 *
 * Purpose: Handle applying recurring settings to checked tasks
 * Extracted from recurringPanel.js to reduce file size and improve maintainability
 *
 * @module recurringSettingsApplicator
 * @version 1.0.0
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, UI_TIMEOUTS, DEFAULT_RECURRING_DELETE_SETTINGS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('RecurringSettingsApplicator', {
    appInit: optional(null),
    AppState: required(),
    showNotification: required(),
    getElementById: required(),
    querySelectorAll: required(),
    normalizeRecurringSettings: required(),
    calculateNextOccurrence: required(),
    updateAppState: optional(null),
    syncRecurringStateToDOM: optional(null),
    restartRecurringWatcher: optional(null)
});

/** @type {{appInit: Object|null, AppState: Object, showNotification: Function, getElementById: Function, querySelectorAll: Function, normalizeRecurringSettings: Function, calculateNextOccurrence: Function, updateAppState: Function|null, syncRecurringStateToDOM: Function|null, restartRecurringWatcher: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setRecurringSettingsApplicatorDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// MAIN APPLY FUNCTION
// ============================================================================

/**
 * Apply recurring settings to checked tasks
 *
 * @param {Object} panel - The RecurringPanel instance (for calling internal methods)
 * @param {Function} buildSettingsFromPanel - Function to build settings from panel form
 * @returns {Promise<void>}
 */
export async function applyRecurringSettings(panel, buildSettingsFromPanel) {

    try {
        // Wait for core systems to be ready
        await _deps.appInit?.waitForCore();

        const state = _deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;

        if (!activeCycleId) {
            _deps.showNotification("⚠ " + getLabel('notify.recurringNoActiveFound'));
            return;
        }

        const cycleData = state.data?.cycles?.[activeCycleId];
        if (!cycleData) {
            _deps.showNotification("⚠ " + getLabel('notify.recurringDataNotFound'));
            return;
        }

        const checkedEls = _deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK_CHECKED);

        if (!checkedEls.length) {
            _deps.showNotification("⚠ " + getLabel('notify.recurringNoChecked'));
            return;
        }

        const settings = _deps.normalizeRecurringSettings(buildSettingsFromPanel());

        // Set defaultRecurTime if not using specific time
        if (!settings.specificTime && !settings.defaultRecurTime) {
            settings.defaultRecurTime = new Date().toISOString();
        }

        // Read ALL DOM state before entering AppState callback
        // (DOM queries must not happen inside state producers)
        const saveAsDefault = _deps.getElementById(DOM_IDS.SET_DEFAULT_RECURRING)?.checked || false;
        const checkedTaskData = Array.from(checkedEls).map(checkbox => {
            const taskEl = checkbox.closest(DATA_SELECTORS.TASK_ID_ELEMENT);
            return {
                taskId: taskEl?.dataset.taskId || null,
                textFromDOM: taskEl?.querySelector(DOM_SELECTORS.RECURRING_TASK_TEXT)?.textContent || null
            };
        }).filter(d => d.taskId);

        // Batch all updates in one AppState operation
        if (_deps.updateAppState) {
            await _deps.updateAppState(draft => {
                // Save default recurring settings if requested
                if (saveAsDefault) {
                    if (!draft.settings) draft.settings = {};
                    draft.settings.defaultRecurringSettings = settings;
                }

                const cycle = draft.data.cycles[activeCycleId];
                if (!cycle.recurringTemplates) {
                    cycle.recurringTemplates = {};
                }

                checkedTaskData.forEach(({ taskId, textFromDOM }) => {
                    // Check if task exists in task list
                    const task = cycle.tasks.find(t => t.id === taskId);

                    // Only update task if it exists in the task list
                    if (task) {
                        task.recurring = true;
                        task.schemaVersion = 2;
                        task.recurringSettings = structuredClone(settings);
                        if (task.deleteWhenComplete === undefined) {
                            task.deleteWhenComplete = true;
                        }
                        if (!task.deleteWhenCompleteSettings) {
                            task.deleteWhenCompleteSettings = { ...DEFAULT_RECURRING_DELETE_SETTINGS };
                        }
                    }

                    // Always update the template — preserve all fields the watcher reads
                    const existingTemplate = cycle.recurringTemplates[taskId];
                    const templateText = task?.text ||
                                       existingTemplate?.text ||
                                       textFromDOM ||
                                       getLabel('noun.untitledTask');

                    cycle.recurringTemplates[taskId] = {
                        id: taskId,
                        text: templateText,
                        dueDate: task?.dueDate || existingTemplate?.dueDate || null,
                        highPriority: task?.highPriority || existingTemplate?.highPriority || false,
                        priorityColor: task?.priorityColor || existingTemplate?.priorityColor || null,
                        remindersEnabled: task?.remindersEnabled || existingTemplate?.remindersEnabled || false,
                        deleteWhenComplete: task?.deleteWhenComplete ?? existingTemplate?.deleteWhenComplete ?? true,
                        deleteWhenCompleteSettings: task?.deleteWhenCompleteSettings
                            || existingTemplate?.deleteWhenCompleteSettings
                            || { ...DEFAULT_RECURRING_DELETE_SETTINGS },
                        recurring: true,
                        recurringSettings: structuredClone(settings),
                        occurrenceCount: existingTemplate?.occurrenceCount ?? 0,
                        lastTriggeredTimestamp: existingTemplate?.lastTriggeredTimestamp ?? null,
                        nextScheduledOccurrence: _deps.calculateNextOccurrence(settings, Date.now()),
                        schemaVersion: 2
                    };
                });
            }, true); // Immediate save
        }

        // Sync DOM elements with new recurring state
        if (_deps.syncRecurringStateToDOM) {
            checkedEls.forEach(checkbox => {
                const taskEl = checkbox.closest(DATA_SELECTORS.TASK_ID_ELEMENT);
                if (!taskEl) return;
                taskEl.classList.add(DOM_CLASSES.RECURRING);
                taskEl.setAttribute(DATA_SELECTORS.ATTR_RECURRING_SETTINGS, JSON.stringify(settings));
                const recurringBtn = taskEl.querySelector(DOM_SELECTORS.RECURRING_BTN);
                if (recurringBtn) {
                    recurringBtn.classList.add(DOM_CLASSES.ACTIVE);
                    recurringBtn.setAttribute("aria-pressed", "true");
                }
                _deps.syncRecurringStateToDOM(taskEl, settings);
            });
        }

        // Show success notifications
        if (_deps.getElementById(DOM_IDS.SET_DEFAULT_RECURRING)?.checked) {
            _deps.showNotification('✅ ' + getLabel('notify.recurringDefaultSaved'), "success", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        // Call panel methods for UI updates
        panel.updateRecurringSummary();
        _deps.showNotification('✅ ' + getLabel('notify.recurringApplied'), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);

        // Transition to browsing mode before re-render (hides settings, checkboxes, toggle)
        panel.state.selectedTaskId = null;
        panel.setPanelMode('browsing');

        await panel.updateRecurringPanel();

        // Post-apply UI updates with delay for DOM to settle
        setTimeout(() => {
            updateUIAfterApply(panel);
        }, 10);

        // Uncheck all checkboxes (data reset — mode already hides them)
        _deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK).forEach(cb => {
            cb.checked = false;
        });

        panel.updateRecurringPanelButtonVisibility();
        panel.updateRecurringInfoLink();
        panel.clearRecurringForm();

        // Restart watcher at active interval since templates now exist
        _deps.restartRecurringWatcher?.();

    } catch (error) {
        console.error('❌ Failed to apply recurring settings:', error);
        _deps.showNotification('❌ ' + getLabel('notify.recurringApplyFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SLOW);

        // Cleanup on error — return to browsing mode
        panel.state.selectedTaskId = null;
        panel.setPanelMode('browsing');

        _deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK).forEach(cb => {
            cb.checked = false;
        });

        throw error;
    }
}

/**
 * Update UI after settings are applied
 * @param {Object} panel - The RecurringPanel instance
 * @returns {void}
 */
function updateUIAfterApply(panel) {
    const checkedTasks = _deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM_CHECKED);

    if (checkedTasks.length > 0) {
        const firstCheckedTask = checkedTasks[0];

        // Keep first task selected, clear the rest
        _deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
            if (el !== firstCheckedTask) {
                el.classList.remove(DOM_CLASSES.SELECTED, DOM_CLASSES.CHECKED);
            }
        });

        // Select the first checked task and show its preview
        const taskId = firstCheckedTask.dataset.taskId;
        panel.state.selectedTaskId = taskId;
        firstCheckedTask.classList.add(DOM_CLASSES.SELECTED);
        firstCheckedTask.setAttribute("aria-selected", "true");

        // Update preview with new settings from template
        const state = _deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        const template = state.data?.cycles?.[activeCycleId]?.recurringTemplates?.[taskId];

        if (template) {
            panel.showTaskSummaryPreview(template);
        }

        panel.setPanelMode('previewing');
    } else {
        // No checked tasks — clear all selections, stay in browsing
        _deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
            el.classList.remove(DOM_CLASSES.SELECTED, DOM_CLASSES.CHECKED);
        });
        panel.state.selectedTaskId = null;
        panel.setPanelMode('browsing');
    }
}

