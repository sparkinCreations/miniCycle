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
import { applyTaskStatusLabel } from '../task/taskUtils.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS, DEFAULT_REMINDERS, LIMITS, DEBOUNCE, SYSTEM_NOTIFICATIONS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
// Date-only strings ("YYYY-MM-DD", which is exactly what <input type="date">.value
// yields) parse as UTC midnight via new Date(). In any negative UTC offset that
// lands on the PREVIOUS local day, so due dates compared or displayed with
// new Date() were a day early across the Americas. recurringDateUtils already
// owned the correct local-midnight parser and the recurring subsystem already
// used it; the due-date paths simply never adopted it. Pure module, no imports.
import { parseDateAsLocal } from '../recurring/recurringDateUtils.js';
import { getActiveRoutineId, getRoutine, getRoutines } from '../utils/cycleMode.js';
// Pure leaf module (no app imports) — the same static import reminders.js uses.
import { isNativeApp, scheduleNativeDueDateNotifications, cancelNativeDueDateNotifications } from '../platform/capacitorBridge.js';

/** AppState subscription key for re-planning the due-day system notifications. */
const DUE_DATE_NOTIFY_SUBSCRIBER = 'dueDates:systemNotifications';

/**
 * The moments at which a due-day system notification should fire, one per
 * day that has open dated tasks, across EVERY routine (a due date is a
 * promise about that task, whichever routine it lives in). A moment is the
 * due day at `hour` local time; moments already past are dropped — an
 * overdue task gets the in-app banner on open, never a repeat notification.
 *
 * @param {Object|null} state - Schema 2.6 state
 * @param {number} [now=Date.now()] - epoch ms
 * @param {number} [hour=LIMITS.DUE_DATE_NOTIFY_HOUR] - local hour on the due day
 * @returns {Array<{at:number, tasks:string[]}>} ascending by `at`
 */
export function computeDueDateNotificationSlots(state, now = Date.now(), hour = LIMITS.DUE_DATE_NOTIFY_HOUR) {
    const routines = getRoutines(state) || {};
    const byMoment = new Map();
    for (const routine of Object.values(routines)) {
        for (const task of routine?.tasks || []) {
            if (!task?.dueDate || task.completed) continue;
            const day = parseDateAsLocal(task.dueDate);
            if (!day) continue;
            const at = new Date(day);
            at.setHours(hour, 0, 0, 0);
            const ts = at.getTime();
            if (ts <= now) continue;
            if (!byMoment.has(ts)) byMoment.set(ts, []);
            byMoment.get(ts).push(task.text || getLabel('notify.dueDateUnnamed'));
        }
    }
    return [...byMoment.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([at, tasks]) => ({ at, tasks }));
}

/**
 * Keep a recurring template's due date in step with its live task.
 *
 * The template is what the watcher recreates the task from, and until Oct
 * 2026 only recurring activation wrote its due date — so a date changed or
 * cleared on the task came back on the next occurrence. Priority already
 * synced this way (taskCRUD); due date was the one field left out.
 * @param {Object|null|undefined} routine - The draft routine inside AppState.update
 * @param {string} taskId
 * @param {string|null} dueDate - '' and undefined are stored as null
 */
function syncTemplateDueDate(routine, taskId, dueDate) {
    const template = routine?.recurringTemplates?.[taskId];
    if (template) template.dueDate = dueDate || null;
}

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('DueDates', {
    appInit: optional(null),
    showNotification: optional(null),
    updateStatsPanel: optional(null),
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    AppState: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, showNotification: Function|null, updateStatsPanel: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, saveRoutineToState: Function|null, AppState: Object|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for MiniCycleDueDates (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, etc. }
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
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            updateStatsPanel: resolvedDeps.updateStatsPanel || (() => {}),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
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
            this._subscribeDueDateNotifications();

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
                    this.syncDueDateNotifications();
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

        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.isReady?.()) {
            throw new Error('State data not found');
        }

        const state = AppState.get();
        const activeCycle = getActiveRoutineId(state);
        const routine = getRoutine(state, activeCycle);

        if (!activeCycle || !routine) {
            console.error('❌ Error: Active routine not found in state.');
            return;
        }

        const task = routine.tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        // The due date is written inside update() below, never on the live task
        // first (CLAUDE.md #13: the undo snapshot would capture the post-change state).

        try {
            await AppState.update(state => {
                if (getRoutine(state, activeCycle)) {
                    const taskToUpdate = getRoutine(state, activeCycle).tasks?.find(t => t.id === taskId);
                    if (taskToUpdate) {
                        taskToUpdate.dueDate = newDueDate;
                    }
                    syncTemplateDueDate(getRoutine(state, activeCycle), taskId, newDueDate);
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
        const overdueTaskStates = { ...(currentState?.appState?.overdueTaskStates || {}) };

        // ✅ Track tasks that just became overdue (by ID, display text for notification)
        const newlyOverdueTasks = [];

        // Completion state for the rows below, keyed by task id. Read from state
        // rather than the checkbox — rule 14: the DOM holds only what is
        // currently rendered, and this label must describe the task, not the view.
        const activeCycleId = getActiveRoutineId(currentState);
        const cycleTasks = new Map(
            (getRoutine(currentState, activeCycleId)?.tasks || []).map(t => [t.id, t])
        );

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

            // parseDateAsLocal already returns LOCAL midnight, so no setHours
            // on dueDate is needed (or correct); today still needs flooring.
            const dueDate = parseDateAsLocal(dueDateValue);
            if (!dueDate) return; // unparsable — leave overdue state untouched
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const displayName = taskText || getLabel('notify.dueDateUnnamed');

            if (dueDate < today) {
                if (!overdueTaskStates[taskId]) {
                    newlyOverdueTasks.push(displayName); // Display text for notification
                }
                task.classList.add(DOM_CLASSES.OVERDUE_TASK);
                applyTaskStatusLabel(task, false,
                    { name: displayName, status: getLabel('nav.overdue') });
                overdueTaskStates[taskId] = true;
            } else {
                task.classList.remove(DOM_CLASSES.OVERDUE_TASK);
                // Restore the completion status rather than dropping the label.
                // removeAttribute() left every task with a FUTURE due date with no
                // accessible name at all — measured: "…, Not completed" became null
                // — so the row lost the one thing a screen reader needs from it.
                // Completion is read from state, never from the checkbox: the DOM
                // holds only what is currently rendered.
                const stateTask = cycleTasks.get(taskId);
                applyTaskStatusLabel(task, stateTask?.completed === true,
                    { name: displayName });
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
            // ✅ Read fresh state (source of truth)
            await _deps.appInit?.waitForCore();

            const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
            if (!AppState?.isReady?.()) {
                console.error('❌ Cannot update due date - no data available');
                return;
            }

            const currentActiveCycle = getActiveRoutineId(AppState.get());
            let taskToUpdate = null;
            await AppState.update(state => {
                taskToUpdate = getRoutine(state, currentActiveCycle)?.tasks?.find(t => t.id === assignedTaskId) || null;
                if (taskToUpdate) {
                    taskToUpdate.dueDate = dueDateInput.value;
                }
                syncTemplateDueDate(getRoutine(state, currentActiveCycle), assignedTaskId, dueDateInput.value);
            }, true);

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

                const autoReset = this.toggleAutoReset.checked;
                this.updateDueDateVisibility(autoReset);

                const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
                if (!AppState?.isReady?.()) {
                    console.error('❌ State data required for due date toggle');
                    return;
                }

                const activeCycle = getActiveRoutineId(AppState.get());

                if (activeCycle) {
                    try {
                        await AppState.update(state => {
                            if (getRoutine(state, activeCycle)) {
                                getRoutine(state, activeCycle).autoReset = autoReset;
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
        const autoReset = this.toggleAutoReset.checked;
        this.updateDueDateVisibility(autoReset);

    }

    /**
     * Handle due date input changes
     * @param {Event} event - The change event
     * @returns {Promise<void>}
     */
    handleDueDateChange = async (event) => {
        if (!event.target.classList.contains(DOM_CLASSES.DUE_DATE)) return;

        const taskItem = event.target.closest(".task");
        const taskId = taskItem?.dataset.taskId;
        const dueDateValue = event.target.value;

        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ State data required for handleDueDateChange');
            return;
        }

        const state = AppState.get();
        const activeCycle = getActiveRoutineId(state);
        const routine = getRoutine(state, activeCycle);
        const reminders = state.customReminders || DEFAULT_REMINDERS;

        if (!activeCycle || !routine) {
            console.error("❌ Error: Active routine not found in state.");
            return;
        }

        const task = routine.tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn(`⚠️ Task with ID "${taskId}" not found in active cycle`);
            return;
        }

        try {
            await AppState.update(state => {
                const taskToUpdate = getRoutine(state, activeCycle)?.tasks?.find(t => t.id === taskId);
                if (taskToUpdate) {
                    taskToUpdate.dueDate = dueDateValue;
                }
                syncTemplateDueDate(getRoutine(state, activeCycle), taskId, dueDateValue);
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
            // Local-midnight parse — see the import note; new Date() here fired
            // the due-soon reminder a day early in negative UTC offsets.
            const selectedDate = parseDateAsLocal(dueDateValue);
            if (!selectedDate) return;

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
    // ============================================
    // DUE-DAY SYSTEM NOTIFICATIONS
    // ============================================
    //
    // With both "Enable Due Date Notifications" and the system/browser
    // notifications channel on, every day that has open dated tasks gets ONE
    // OS-level notification at DUE_DATE_NOTIFY_HOUR listing them. The plan is
    // recomputed from state after every state write (debounced), so completing,
    // deleting or re-dating a task, a cycle reset clearing dates, a restore or
    // an import all simply re-plan — there is no per-path cancel to forget.
    //
    // Native: the OS holds the whole set (scheduleNativeDueDateNotifications),
    // so it delivers with the app closed. Web/desktop: a timer for the next
    // moment, posted through the service worker like task reminders, so it
    // delivers only while the page is open — the same caveat reminders carry.

    _state() {
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        return AppState?.isReady?.() ? AppState.get() : null;
    }

    _subscribeDueDateNotifications() {
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.subscribe || this._dueDateSubscribed) return;
        this._onStateForDueDateNotifications = () => {
            clearTimeout(this._dueDateSyncDebounce);
            this._dueDateSyncDebounce = setTimeout(() => this.syncDueDateNotifications(), DEBOUNCE.DUE_DATE_NOTIFY_SYNC);
        };
        AppState.subscribe(DUE_DATE_NOTIFY_SUBSCRIBER, this._onStateForDueDateNotifications);
        this._dueDateSubscribed = true;
    }

    /** Both switches on: due-date notices AND the system/browser channel. */
    _dueDateNotificationsOn(state) {
        const settings = state?.customReminders || {};
        return !!(settings.dueDatesReminders && settings.browserNotifications);
    }

    /** Web/desktop only: the page may post system notifications. Overridable in tests. */
    _canPostWebNotifications() {
        return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }

    /**
     * Title and body for one due-day slot.
     * @param {{at:number, tasks:string[]}} slot
     * @returns {{title:string, body:string}}
     */
    _dueDateSlotContent(slot) {
        return {
            title: getLabel('notify.dueDateNotificationTitle', { count: slot.tasks.length }),
            body: slot.tasks.map(name => getLabel('notify.dueDateNotificationLine', { vars: { name } })).join('\n')
        };
    }

    /**
     * Re-plan the due-day system notifications from current state.
     * Idempotent: safe to call on every change.
     * @returns {void}
     */
    syncDueDateNotifications() {
        clearTimeout(this._dueDateTimerId);
        this._dueDateTimerId = null;
        const state = this._state();
        if (!state || !this._dueDateNotificationsOn(state)) {
            if (isNativeApp()) cancelNativeDueDateNotifications(LIMITS.NATIVE_DUE_DATE_SCHEDULE_MAX);
            return;
        }
        const slots = computeDueDateNotificationSlots(state);
        if (isNativeApp()) {
            scheduleNativeDueDateNotifications({
                items: slots.slice(0, LIMITS.NATIVE_DUE_DATE_SCHEDULE_MAX).map(slot => ({ at: slot.at, ...this._dueDateSlotContent(slot) })),
                maxCount: LIMITS.NATIVE_DUE_DATE_SCHEDULE_MAX
            });
            return;
        }
        if (!this._canPostWebNotifications()) return;
        const next = slots[0];
        if (!next) return;
        // Clamped like reminders.js scheduleNextReminder: setTimeout overflows a
        // signed 32-bit delay and fires at once, so re-arm until the moment is real.
        this._dueDateTimerId = setTimeout(() => {
            this._dueDateTimerId = null;
            if (Date.now() < next.at) {
                this.syncDueDateNotifications();
                return;
            }
            this._postDueDateNotification(next).finally(() => this.syncDueDateNotifications());
        }, Math.min(next.at - Date.now(), LIMITS.MAX_TIMEOUT_MS));
    }

    /**
     * Post one due-day slot as a system notification (web/desktop).
     * @param {{at:number, tasks:string[]}} slot
     * @returns {Promise<void>}
     */
    async _postDueDateNotification(slot) {
        const { title, body } = this._dueDateSlotContent(slot);
        try {
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration) {
                await registration.showNotification(title, { body, icon: SYSTEM_NOTIFICATIONS.ICON, tag: SYSTEM_NOTIFICATIONS.TAG_DUE_DATE });
            } else {
                new Notification(title, { body, icon: SYSTEM_NOTIFICATIONS.ICON });
            }
        } catch (e) {
            console.warn('⚠️ Due-date system notification failed:', e);
        }
    }

    remindOverdueTasks() {

        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (!AppState?.isReady?.()) {
            console.error('❌ State data required for remindOverdueTasks');
            return;
        }

        const remindersSettings = AppState.get().customReminders || DEFAULT_REMINDERS;

        const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;

        // Only proceed if due date notifications are enabled
        if (!dueDatesRemindersEnabled) {
            return;
        }

        const overdueTasks = [...this.deps.querySelectorAll(DOM_SELECTORS.TASK)]
            .filter(task => task.classList.contains(DOM_CLASSES.OVERDUE_TASK))
            .map(task => task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent)
            .filter(Boolean);

        if (overdueTasks.length > 0) {
            this.deps.showNotification("⚠️ " + getLabel('notify.dueDateOverdue') + `\n~ ${overdueTasks.join("\n~ ")}`, "error");
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
        clearTimeout(this._dueDateTimerId);
        clearTimeout(this._dueDateSyncDebounce);
        this._dueDateTimerId = null;
        const AppState = typeof this.deps.AppState === 'function' ? this.deps.AppState() : this.deps.AppState;
        if (this._dueDateSubscribed && AppState?.unsubscribe) {
            AppState.unsubscribe(DUE_DATE_NOTIFY_SUBSCRIBER, this._onStateForDueDateNotifications);
        }
        this._dueDateSubscribed = false;
    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackNotification(message, type) {
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
