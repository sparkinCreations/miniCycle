/**
 * 📅 miniCycle Due Dates Module (DI-Pure)
 * Handles task due dates, overdue detection, and due date reminders
 *
 * Features:
 * - Per-task due date assignment
 * - Overdue task detection and visual indicators
 * - Integration with auto-reset mode
 * - Due date reminder notifications
 * - Persistence across sessions
 * - Integration with Schema 2.5 data structure
 *
 * @module dueDates
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('DueDates', {
    appInit: optional(null),
    loadMiniCycleData: optional(null),
    showNotification: optional(null),
    updateStatsPanel: optional(null),
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    saveTaskToSchema25: optional(null),
    AppState: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, loadMiniCycleData: Function|null, showNotification: Function|null, updateStatsPanel: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, saveTaskToSchema25: Function|null, AppState: Object|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for MiniCycleDueDates (call before creating instance)
 * @param {Object} dependencies - { loadMiniCycleData, showNotification, etc. }
 * @returns {void}
 */
export function setDueDatesDependencies(dependencies) {
    di.setDependencies(dependencies);
}

export class MiniCycleDueDates {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

        // Store dependencies with intelligent fallbacks
        this.deps = {
            loadMiniCycleData: resolvedDeps.loadMiniCycleData || this.fallbackLoadData,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            updateStatsPanel: resolvedDeps.updateStatsPanel || (() => {}),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
            saveTaskToSchema25: resolvedDeps.saveTaskToSchema25 || this.fallbackSave,
            getElementById: resolvedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: resolvedDeps.querySelectorAll || ((selector) => document.querySelectorAll(selector)),
            safeAddEventListener: resolvedDeps.safeAddEventListener,
            AppState: resolvedDeps.AppState || null
        };

        // Store reference to auto reset toggle element (will be set in init)
        this.toggleAutoReset = null;

    }

    /**
     * Initialize due dates system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {

        // Wait for core systems to be ready
        await _deps.appInit?.waitForCore();

        try {
            // Get reference to toggle element
            this.toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);

            if (!this.toggleAutoReset) {
                console.warn('⚠️ toggleAutoReset element not found');
            }

            this.setupDueDateSystem();

            // ✅ Add hook to check overdue tasks after app is fully ready
            _deps.appInit?.addHook?.('afterApp', async () => {

                // Check if tasks exist in DOM before proceeding
                const tasks = this.deps.querySelectorAll(DOM_SELECTORS.TASK);
                if (tasks.length === 0) {
                    return;
                }

                // Small delay to ensure DOM is fully rendered
                setTimeout(async () => {
                    await this.checkOverdueTasks();
                    this.remindOverdueTasks();
                }, 300);
            });

        } catch (error) {
            console.warn('⚠️ Due dates system initialization failed:', error);
            this.deps.showNotification(getLabel('notify.featureUnavailable'), 'warning');
        }
    }

    /**
     * Save due date for a specific task
     * @param {string} taskId - The ID of the task
     * @param {string|null} newDueDate - The due date to assign, or null to clear
     * @returns {Promise<void>}
     */
    async saveTaskDueDate(taskId, newDueDate) {

        await _deps.appInit?.waitForCore();

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle } = schemaData;

        if (!activeCycle || !cycles[activeCycle]) {
            console.error('❌ Error: Active cycle not found in Schema 2.5.');
            return;
        }

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        // Update task due date
        task.dueDate = newDueDate;

        // ✅ Use AppState only (no localStorage fallback)
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for saveTaskDueDate');
            return;
        }

        try {
            await AppState.update(state => {
                if (state?.data?.cycles?.[activeCycle]) {
                    const taskToUpdate = state.data.cycles[activeCycle].tasks?.find(t => t.id === taskId);
                    if (taskToUpdate) {
                        taskToUpdate.dueDate = newDueDate;
                    }
                }
            }, true);
        } catch (error) {
            console.error('❌ Error saving task due date:', error);
        }
    }

    /**
     * Check for overdue tasks and apply visual styling
     * @param {HTMLElement|null} taskToCheck - Specific task to check, or null to check all
     * @returns {Promise<void>}
     */
    async checkOverdueTasks(taskToCheck = null) {
        await _deps.appInit?.waitForCore();

        const tasks = taskToCheck ? [taskToCheck] : this.deps.querySelectorAll(DOM_SELECTORS.TASK);

        // ✅ Use AppState only (no localStorage fallback)
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.isReady?.()) {
            // Expected during initial boot — data loads after core phase
            return;
        }

        // Get current overdue states from AppState
        const currentState = AppState.get();
        let overdueTaskStates = { ...(currentState?.appState?.overdueTaskStates || {}) };

        // ✅ Track tasks that just became overdue (by ID, display text for notification)
        let newlyOverdueTasks = [];

        tasks.forEach(task => {
            // ✅ FIX: Use task ID instead of task text for tracking (prevents issues when renaming tasks)
            const taskId = task.dataset?.taskId;
            const taskText = task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent;
            const dueDateInput = task.querySelector(DOM_SELECTORS.DUE_DATE);
            if (!dueDateInput || !taskId) return;

            const dueDateValue = dueDateInput.value;
            if (!dueDateValue) {
                // ✅ Date was cleared — remove overdue class
                task.classList.remove(DOM_CLASSES.OVERDUE_TASK);
                delete overdueTaskStates[taskId];
                return;
            }

            const dueDate = new Date(dueDateValue);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            const displayName = taskText || getLabel('notify.dueDateUnnamed');

            if (dueDate < today) {
                if (!overdueTaskStates[taskId]) {
                    newlyOverdueTasks.push(displayName); // Display text for notification
                }
                task.classList.add(DOM_CLASSES.OVERDUE_TASK);
                task.setAttribute('aria-label', getLabel('action.taskItemLabel', { vars: { name: displayName, status: 'overdue' } }));
                overdueTaskStates[taskId] = true;
            } else {
                task.classList.remove(DOM_CLASSES.OVERDUE_TASK);
                task.removeAttribute('aria-label');
                delete overdueTaskStates[taskId];
            }
        });

        // ✅ Save overdue states back via AppState
        try {
            await AppState.update(state => {
                if (!state.appState) state.appState = {};
                state.appState.overdueTaskStates = overdueTaskStates;
            }, true);
        } catch (error) {
            console.error('❌ Error saving overdue states:', error);
        }

        // ✅ Show notification ONLY if there are newly overdue tasks
        if (newlyOverdueTasks.length > 0) {
            this.deps.showNotification("⚠️ " + getLabel('notify.dueDateOverdue') + `\n~ ${newlyOverdueTasks.join("\n~ ")}`, "error");
        }
    }

    /**
     * Create a due date input element for a task
     * @param {string} assignedTaskId - Task ID
     * @param {string|null} dueDate - Initial due date value
     * @param {boolean} autoResetEnabled - Whether auto-reset is enabled
     * @param {Object} currentCycle - Current cycle data
     * @param {string} activeCycle - Active cycle ID
     * @returns {HTMLInputElement} The created due date input element
     */
    createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle) {
        const dueDateInput = document.createElement("input");
        dueDateInput.type = "date";
        dueDateInput.id = `due-date-input-${assignedTaskId}`;
        dueDateInput.name = `taskDueDate-${assignedTaskId}`;
        dueDateInput.classList.add(DOM_CLASSES.DUE_DATE);
        dueDateInput.setAttribute("aria-describedby", `task-desc-${assignedTaskId}`);
        dueDateInput.setAttribute("aria-label", getLabel('taskOption.dueDate'));

        if (dueDate) {
            dueDateInput.value = dueDate;
            dueDateInput.classList.remove(DOM_CLASSES.HIDDEN);
        } else {
            dueDateInput.classList.add(DOM_CLASSES.HIDDEN);
        }

        const safeAdd = this.deps.safeAddEventListener;
        dueDateInput._changeHandler = async () => {
            // ✅ Read fresh state from localStorage (source of truth)
            await _deps.appInit?.waitForCore();

            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Cannot update due date - no data available');
                return;
            }

            const { cycles, activeCycle: currentActiveCycle } = schemaData;
            const currentCycle = cycles[currentActiveCycle];
            const taskToUpdate = currentCycle?.tasks?.find(t => t.id === assignedTaskId);

            if (taskToUpdate) {
                taskToUpdate.dueDate = dueDateInput.value;
                this.deps.saveTaskToSchema25(currentActiveCycle, currentCycle);
            }

            this.deps.updateStatsPanel();
            this.deps.updateProgressBar();
            this.deps.checkCompleteAllButton();

            const taskText = taskToUpdate?.text || getLabel('notify.dueDateUnnamed');
            if (dueDateInput.value) {
                this.deps.showNotification("📅 " + getLabel('notify.dueDateUpdated', { vars: { name: taskText } }), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);

                // Auto-enable due date notifications when a due date is set
                this._autoEnableDueDateReminders();
            } else {
                this.deps.showNotification("📅 " + getLabel('notify.dueDateCleared', { vars: { name: taskText } }), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            }
        };
        safeAdd(dueDateInput, "change", dueDateInput._changeHandler);

        return dueDateInput;
    }

    /**
     * Set up due date button click interaction
     * @param {HTMLElement} buttonContainer - Container with task buttons
     * @param {HTMLInputElement} dueDateInput - The due date input element
     * @returns {void}
     */
    setupDueDateButtonInteraction(buttonContainer, dueDateInput) {
        const dueDateButton = buttonContainer.querySelector(DOM_SELECTORS.SET_DUE_DATE);
        if (!dueDateButton) {
            console.warn('⚠️ Due date button not found in container');
            return;
        }

        // ✅ Store the handler so we can check if it's already attached
        if (dueDateButton.dataset.listenerAttached === 'true') {
            return; // Already has listener
        }

        const safeAdd = this.deps.safeAddEventListener;
        dueDateButton._clickHandler = () => {
            dueDateInput.classList.toggle(DOM_CLASSES.HIDDEN);
            dueDateButton.classList.toggle(DOM_CLASSES.ACTIVE, !dueDateInput.classList.contains(DOM_CLASSES.HIDDEN));
        };
        safeAdd(dueDateButton, "click", dueDateButton._clickHandler);

        dueDateButton.dataset.listenerAttached = 'true';
    }

    /**
     * Set up the complete due date system
     * Attaches event listeners and initializes visibility
     */
    setupDueDateSystem() {

        if (!this.toggleAutoReset) {
            console.warn('⚠️ toggleAutoReset not available, skipping setup');
            return;
        }

        // Make sure we only attach the listener once
        const safeAdd = this.deps.safeAddEventListener;

        if (!this.toggleAutoReset.dataset.dueDateListenerAdded) {
            this.toggleAutoReset.dataset.dueDateListenerAdded = true;

            this.toggleAutoReset._dueDateChangeHandler = async () => {

                let autoReset = this.toggleAutoReset.checked;
                this.updateDueDateVisibility(autoReset);

                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for due date toggle');
                    return;
                }

                const { activeCycle } = schemaData;

                if (activeCycle) {

                    // ✅ Use AppState only (no localStorage fallback)
                    const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
                    if (!AppState?.isReady?.()) {
                        console.error('❌ AppState not ready for auto reset toggle');
                        return;
                    }

                    try {
                        await AppState.update(state => {
                            if (state?.data?.cycles?.[activeCycle]) {
                                state.data.cycles[activeCycle].autoReset = autoReset;
                            }
                        }, true);
                    } catch (error) {
                        console.error('❌ Error saving auto reset setting:', error);
                    }
                } else {
                    console.warn('⚠️ No active cycle found for due date settings');
                }
            };
            safeAdd(this.toggleAutoReset, "change", this.toggleAutoReset._dueDateChangeHandler);
        }

        // ✅ Use safeAddEventListener for document change handler
        safeAdd(document, "change", this.handleDueDateChange);

        // ✅ Apply initial visibility state on load
        let autoReset = this.toggleAutoReset.checked;
        this.updateDueDateVisibility(autoReset);

    }

    /**
     * Handle due date input changes
     * @param {Event} event - The change event
     * @returns {Promise<void>}
     */
    handleDueDateChange = async (event) => {
        if (!event.target.classList.contains(DOM_CLASSES.DUE_DATE)) return;

        let taskItem = event.target.closest(".task");
        let taskId = taskItem?.dataset.taskId;
        let dueDateValue = event.target.value;

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for handleDueDateChange');
            return;
        }

        const { cycles, activeCycle, reminders } = schemaData;

        if (!activeCycle || !cycles[activeCycle]) {
            console.error("❌ Error: Active cycle not found in Schema 2.5.");
            return;
        }

        const task = cycles[activeCycle].tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        // ✅ Use AppState only (no localStorage fallback)
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ AppState not ready for handleDueDateChange');
            return;
        }

        try {
            await AppState.update(state => {
                const taskToUpdate = state?.data?.cycles?.[activeCycle]?.tasks?.find(t => t.id === taskId);
                if (taskToUpdate) {
                    taskToUpdate.dueDate = dueDateValue;
                }
            }, true);
        } catch (error) {
            console.error('❌ Error saving due date:', error);
            return;
        }

        this.checkOverdueTasks(taskItem);

        // ✅ Load Due Date Notification Setting from Schema 2.5
        const remindersSettings = reminders || {};
        const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;

        if (!dueDatesRemindersEnabled) {
            return;
        }

        if (dueDateValue) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(dueDateValue);
            selectedDate.setHours(0, 0, 0, 0);

            // Only show "due soon" if the date is within the next 3 days
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
            const daysUntilDue = selectedDate - today;

            if (daysUntilDue > 0 && daysUntilDue <= threeDaysMs) {
                const taskText = task.text || getLabel('notify.dueDateUnnamed');
                this.deps.showNotification("📅 " + getLabel('notify.dueDateDueSoon', { vars: { name: taskText } }), "default");
            }
        }
    }

    /**
     * Show notification for overdue tasks
     * Checks reminder settings and displays notification if due date reminders are enabled
     */
    remindOverdueTasks() {

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for remindOverdueTasks');
            return;
        }

        const { reminders } = schemaData;
        const remindersSettings = reminders || {};

        const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;

        // Only proceed if due date notifications are enabled
        if (!dueDatesRemindersEnabled) {
            return;
        }

        let overdueTasks = [...this.deps.querySelectorAll(DOM_SELECTORS.TASK)]
            .filter(task => task.classList.contains(DOM_CLASSES.OVERDUE_TASK))
            .map(task => task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent)
            .filter(Boolean);

        if (overdueTasks.length > 0) {
            this.deps.showNotification("⚠️ " + getLabel('notify.dueDateOverdue') + `\n~ ${overdueTasks.join("\n~ ")}`, "error");
        } else {
        }
    }

    /**
     * Update visibility of due date fields and related UI elements
     * @param {boolean} autoReset - Whether Auto Reset is enabled
     * @returns {void}
     */
    updateDueDateVisibility(autoReset) {
        const dueDatesRemindersOption = this.deps.getElementById(DOM_IDS.DUE_DATES_REMINDERS)?.parentNode;
        if (dueDatesRemindersOption) {
            dueDatesRemindersOption.style.display = "block";
        }

        // ✅ NO LONGER hide "Set Due Date" buttons based on mode
        // Button visibility is now controlled by taskOptionButtons customization
        // this.deps.querySelectorAll(".set-due-date").forEach(button => {
        //     button.classList.toggle("hidden", autoReset);
        // });

        // Show due dates that have a value, hide empty ones (all modes)
        this.deps.querySelectorAll(DOM_SELECTORS.DUE_DATE).forEach(input => {
            if (input.value) {
                input.classList.remove(DOM_CLASSES.HIDDEN);
            } else {
                input.classList.add(DOM_CLASSES.HIDDEN);
            }
        });

        // Due date reminders option: only relevant when reminders are meaningful
        // (kept visible in all modes so users can configure)

        // Recheck and reapply overdue classes as needed
        this.checkOverdueTasks();

    }

    // ============================================
    // AUTO-ENABLE NOTIFICATIONS
    // ============================================

    /**
     * Auto-enable due date reminders when a due date is first set.
     * Updates both AppState and the checkbox UI if present.
     */
    _autoEnableDueDateReminders() {
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.get) return;

        const state = AppState.get();
        const alreadyEnabled = state.customReminders?.dueDatesReminders;
        if (alreadyEnabled) return;

        AppState.update(s => {
            if (s.customReminders) {
                s.customReminders.dueDatesReminders = true;
            }
            s.metadata.lastModified = Date.now();
        }, true);

        // Sync the checkbox UI if the reminders modal is open
        const checkbox = this.deps.getElementById(DOM_IDS.DUE_DATES_REMINDERS);
        if (checkbox) checkbox.checked = true;

    }

    // ============================================
    // CLEANUP
    // ============================================

    /**
     * Remove document-level listeners for cleanup
     */
    destroy() {
        document.removeEventListener("change", this.handleDueDateChange);
    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackNotification(message, type) {
    }

    fallbackLoadData() {
        console.warn('⚠️ Data loading not available - due dates cannot function');
        return null;
    }

    fallbackSave() {
        console.warn('⚠️ Save function not available - due dates will not persist');
    }

    fallbackAddEventListener(element, event, handler) {
        if (element && element.addEventListener) {
            element.removeEventListener(event, handler);
            element.addEventListener(event, handler);
        } else {
            console.warn('⚠️ Could not add event listener:', event);
        }
    }
}

// ============================================
// MODULE INITIALIZATION & GLOBAL EXPORTS
// ============================================

// DI-pure module (no window.* fallbacks for dependencies)

let dueDatesManager = null;

/**
 * Initialize the due dates manager with dependencies
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<MiniCycleDueDates>} The initialized due dates manager
 */
export async function initDueDatesManager(dependencies = {}) {

    if (dueDatesManager) {
        return dueDatesManager;
    }

    dueDatesManager = new MiniCycleDueDates(dependencies);
    await dueDatesManager.init();

    // Phase 3 - No window.* exports (main script handles exposure)

    return dueDatesManager;
}

// Named exports only (class already exported at declaration)
