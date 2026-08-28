/**
 * miniCycle Recurring Panel — Add Task Flow
 *
 * The "add existing tasks to recurring" sub-feature: offering the non-recurring
 * tasks, tracking the selection, and committing the chosen ones. Split out of
 * `recurringPanel.js` (splits-plan Priority 4), joining the five sub-modules that
 * were already there.
 *
 * PATTERN: plain exported functions taking `(deps, panelState, cb)`, matching the
 * convention the rest of this family already uses — `recurringPanelSetup.js` and
 * friends are called as `_setupSpecificDatesPanel(this.deps, { ... })`. No DI container and
 * no class, so there is nothing to wire at boot.
 *
 * The one extension is `panelState`: this flow READS `panelState.panelMode` and
 * WRITES `panelState.selectedTaskId` / `panelState.preservedCheckedIds`. It is the
 * parent's own `this.state`, passed by REFERENCE so writes land on the parent
 * exactly as they did when these were methods. Deliberately not copied — a
 * snapshot would silently drop the preserved-selection behaviour that exists to
 * survive a DOM rebuild.
 *
 * It is NOT named `state`, and that matters: `handleConfirmAddRecurring` already
 * declares a local `const state = deps.AppState.get()` for the APP state. Naming
 * the parameter `state` let that local shadow it from its declaration onward, so
 * the panel-mode check read the app state instead — the editing branch never ran
 * and the preserved selection was written onto the wrong object. The test written
 * before this extraction is what caught it.
 *
 * `cb` carries the two parent operations this flow triggers: `setPanelMode` and
 * `updateRecurringPanel`. Two callbacks, not a bag.
 *
 * @module recurring/recurringPanelAddTask
 */

import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { ICONS } from '../utils/icons.js';
import { getLabel } from '../labels/labelResolver.js';

/**
 * Setup the "Add Task" button and available tasks list
 */
export function setupAddTaskSection(deps, panelState, cb = {}) {
    const addTaskBtn = deps.getElementById(DOM_IDS.ADD_RECURRING_TASK_BTN);
    const availableTasksList = deps.getElementById(DOM_IDS.AVAILABLE_TASKS_LIST);
    const confirmBtn = deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);

    if (!addTaskBtn || !availableTasksList) {
        console.warn('⚠️ Add task section elements not found');
        return;
    }

    // Toggle available tasks list visibility
    deps.safeAddEventListener(addTaskBtn, "click", () => {
        const isHidden = availableTasksList.classList.contains(DOM_CLASSES.HIDDEN);

        if (isHidden) {
            // Populate and show the list
            populateAvailableTasks(deps, panelState, cb);
            availableTasksList.classList.remove(DOM_CLASSES.HIDDEN);
            addTaskBtn.innerHTML = `<span class="icon" aria-hidden="true">${ICONS['times']}</span> ${getLabel('button.cancel')}`;
        } else {
            // Hide the list and reset
            availableTasksList.classList.add(DOM_CLASSES.HIDDEN);
            addTaskBtn.textContent = getLabel('recurring.addToRecurring');
            if (confirmBtn) confirmBtn.classList.add(DOM_CLASSES.HIDDEN);
        }
    });

    // Setup delegation for checkbox changes
    const nonRecurringList = deps.getElementById(DOM_IDS.NON_RECURRING_TASKS);
    if (nonRecurringList) {
        deps.safeAddEventListener(nonRecurringList, "change", (e) => {
            if (e.target.type === "checkbox") {
                const taskItem = e.target.closest(DATA_SELECTORS.TASK_ID_ELEMENT);
                if (taskItem) {
                    taskItem.classList.toggle(DOM_CLASSES.SELECTED, e.target.checked);
                }
                updateConfirmButtonVisibility(deps, panelState, cb);
            }
        });

        // Also allow clicking the row to toggle
        deps.safeAddEventListener(nonRecurringList, "click", (e) => {
            // Don't toggle if clicking directly on checkbox
            if (e.target.type === "checkbox") return;

            const taskItem = e.target.closest(DATA_SELECTORS.TASK_ID_ELEMENT);
            if (!taskItem) return;

            const checkbox = taskItem.querySelector(DOM_SELECTORS.TASK_CHECKBOX);
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                taskItem.classList.toggle(DOM_CLASSES.SELECTED, checkbox.checked);
                updateConfirmButtonVisibility(deps, panelState, cb);
            }
        });
    }

    // Setup confirm button
    if (confirmBtn) {
        deps.safeAddEventListener(confirmBtn, "click", () => {
            handleConfirmAddRecurring(deps, panelState, cb);
        });
    }

    // Setup select all button
    const selectAllBtn = deps.getElementById(DOM_IDS.SELECT_ALL_ADD_RECURRING);
    if (selectAllBtn && nonRecurringList) {
        deps.safeAddEventListener(selectAllBtn, "click", () => {
            const checkboxes = nonRecurringList.querySelectorAll(DOM_SELECTORS.NON_RECURRING_CHECKBOX);
            const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);

            checkboxes.forEach(cb => {
                cb.checked = anyUnchecked;
                const item = cb.closest(DATA_SELECTORS.TASK_ID_ELEMENT);
                if (item) item.classList.toggle(DOM_CLASSES.SELECTED, anyUnchecked);
            });

            selectAllBtn.textContent = anyUnchecked
                ? getLabel('recurring.deselectAll')
                : getLabel('recurring.selectAll');

            updateConfirmButtonVisibility(deps, panelState, cb);
        });
    }

}


/**
 * Update confirm button visibility based on selection
 */
export function updateConfirmButtonVisibility(deps, panelState, _cb = {}) {
    const confirmBtn = deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);
    const selectedCount = deps.querySelectorAll(DOM_SELECTORS.NON_RECURRING_SELECTED).length;

    if (confirmBtn) {
        if (selectedCount > 0) {
            confirmBtn.classList.remove(DOM_CLASSES.HIDDEN);
            confirmBtn.textContent = selectedCount === 1
                ? getLabel('recurring.addToRecurringShort')
                : getLabel('recurring.addTasksToRecurring', { vars: { count: selectedCount } });
        } else {
            confirmBtn.classList.add(DOM_CLASSES.HIDDEN);
        }
    }
}


/**
 * Populate the available (non-recurring) tasks list
 */
export function populateAvailableTasks(deps, panelState, _cb = {}) {
    const nonRecurringList = deps.getElementById(DOM_IDS.NON_RECURRING_TASKS);
    const noTasksMessage = deps.getElementById(DOM_IDS.NO_AVAILABLE_TASKS);
    const confirmBtn = deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);

    if (!nonRecurringList || !noTasksMessage) {
        console.warn('⚠️ Available tasks list elements not found');
        return;
    }

    // Clear existing list, hide confirm button, reset select all
    nonRecurringList.innerHTML = "";
    if (confirmBtn) confirmBtn.classList.add(DOM_CLASSES.HIDDEN);
    const selectAllBtn = deps.getElementById(DOM_IDS.SELECT_ALL_ADD_RECURRING);
    if (selectAllBtn) selectAllBtn.textContent = getLabel('recurring.selectAll');

    try {
        if (!deps.AppState.isReady?.()) {
            console.warn('⚠️ AppState not ready for populating available tasks');
            noTasksMessage.classList.remove(DOM_CLASSES.HIDDEN);
            noTasksMessage.textContent = getLabel('notify.taskLoadFailed');
            return;
        }

        const state = deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        const currentCycle = state.data?.cycles?.[activeCycleId];

        if (!currentCycle) {
            console.warn('⚠️ No active cycle found');
            noTasksMessage.classList.remove(DOM_CLASSES.HIDDEN);
            noTasksMessage.textContent = getLabel('notify.noRoutineLoaded');
            return;
        }

        const allTasks = currentCycle.tasks || [];
        const recurringTemplateIds = Object.keys(currentCycle.recurringTemplates || {});

        // Filter to non-recurring tasks only (check both template AND task.recurring flag
        // to match the per-task button check in taskButtons.js)
        const nonRecurringTasks = allTasks.filter(task =>
            task && task.id && task.text && !recurringTemplateIds.includes(task.id) && !task.recurring
        );

        if (nonRecurringTasks.length === 0) {
            // Check if there are no tasks at all vs all are recurring
            if (allTasks.length === 0) {
                noTasksMessage.textContent = getLabel('empty.noRoutineTasks');
            } else {
                noTasksMessage.textContent = getLabel('notify.allTasksRecurring');
            }
            noTasksMessage.classList.remove(DOM_CLASSES.HIDDEN);
            return;
        }

        // Hide "no tasks" message
        noTasksMessage.classList.add(DOM_CLASSES.HIDDEN);

        // Render non-recurring tasks with checkboxes
        nonRecurringTasks.forEach(task => {
            const li = document.createElement("li");
            li.dataset.taskId = task.id;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `add-recurring-${task.id}`;
            checkbox.setAttribute("aria-label", getLabel('recurring.selectTask', { vars: { name: task.text } }));

            const textSpan = document.createElement("span");
            textSpan.className = "task-text";
            textSpan.textContent = task.text;

            li.appendChild(checkbox);
            li.appendChild(textSpan);
            nonRecurringList.appendChild(li);
        });

    } catch (error) {
        console.error('❌ Error populating available tasks:', error);
        noTasksMessage.classList.remove(DOM_CLASSES.HIDDEN);
        noTasksMessage.textContent = getLabel('notify.taskLoadError');
    }
}


/**
 * Handle confirming add selected tasks as recurring
 * Adds all selected tasks with default recurring settings
 */
export async function handleConfirmAddRecurring(deps, panelState, cb = {}) {

    try {
        if (!deps.AppState.isReady?.()) {
            console.error('❌ AppState not ready');
            deps.showNotification(getLabel('notify.appNotReady'), 'error');
            return;
        }

        // Get selected task IDs
        const selectedItems = deps.querySelectorAll(DOM_SELECTORS.NON_RECURRING_SELECTED);
        const selectedTaskIds = Array.from(selectedItems).map(li => li.dataset.taskId);

        if (selectedTaskIds.length === 0) {
            deps.showNotification(getLabel('notify.recurringNoTasksSelected'), 'warning');
            return;
        }

        const state = deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;

        if (!activeCycleId) {
            console.error('❌ No active cycle');
            deps.showNotification(getLabel('notify.recurringNoActiveCycle'), 'error');
            return;
        }

        // Default recurring settings
        const defaultSettings = deps.normalizeRecurringSettings({
            frequency: 'daily',
            recurIndefinitely: true
        });

        // Add each selected task to recurring templates via shared helper
        await deps.updateAppState(draft => {
            const cycle = draft.data.cycles[activeCycleId];

            selectedTaskIds.forEach(taskId => {
                const task = cycle.tasks.find(t => t.id === taskId);
                if (task) {
                    deps.activateTaskRecurringState(
                        cycle, taskId, defaultSettings, deps.calculateNextOccurrence
                    );
                }
            });
        }, true); // Immediate save

        // Hide the available tasks list
        const availableTasksList = deps.getElementById(DOM_IDS.AVAILABLE_TASKS_LIST);
        const addTaskBtn = deps.getElementById(DOM_IDS.ADD_RECURRING_TASK_BTN);
        const confirmBtn = deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);

        if (availableTasksList) availableTasksList.classList.add(DOM_CLASSES.HIDDEN);
        if (addTaskBtn) addTaskBtn.textContent = getLabel('recurring.addToRecurring');
        if (confirmBtn) confirmBtn.classList.add(DOM_CLASSES.HIDDEN);

        // If the user wasn't already editing settings, return to browsing
        // so the panel refreshes cleanly without opening the settings form.
        // If editing, preserve checked task IDs so they survive the re-render.
        if (panelState.panelMode !== 'editing') {
            panelState.selectedTaskId = null;
            cb.setPanelMode('browsing');
        } else {
            // Save checked IDs before DOM rebuild wipes them
            panelState.preservedCheckedIds = Array.from(
                deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM)
            ).filter(el => {
                const cb = el.querySelector(DOM_SELECTORS.RECURRING_CHECK);
                return cb?.checked;
            }).map(el => el.dataset.taskId);
        }

        // Refresh the panel to show new recurring tasks
        await cb.updateRecurringPanel();

        // Refresh main task list from state
        setTimeout(() => {
            deps.refreshUIFromState?.();
        }, 0);

        const taskWord = getLabel('noun.task', { count: selectedTaskIds.length });
        deps.showNotification(`🔁 ${getLabel('notify.recurringAdded', { vars: { count: selectedTaskIds.length, taskWord } })}`, 'success');

    } catch (error) {
        console.error('❌ Error adding tasks as recurring:', error);
        deps.showNotification(getLabel('notify.recurringAddFailed'), 'error');
    }
}
