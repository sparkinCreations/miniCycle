/**
 * 📅 miniCycle Due Dates Module (DI-Pure)
 * Handles task due dates, overdue detection, and due date reminders
 *
 * Features:
 * - Per-task due date, with an optional due time stored separately
 *   (task.dueDate "YYYY-MM-DD", task.dueTime "HH:MM" or null)
 * - A due-date line under the task; tapping it (or the calendar button)
 *   opens one shared picker dialog
 * - Overdue task detection and visual indicators
 * - Integration with auto-reset mode
 * - Due date reminder notifications
 * - Persistence across sessions
 * - Integration with the Schema 2.6 state document
 *
 * @module dueDates
 */

import { createDIModule, optional } from '../core/diBase.js';
import { applyTaskStatusLabel } from '../task/taskUtils.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS, UI_TIMEOUTS, DEFAULT_REMINDERS, LIMITS, DEBOUNCE, SYSTEM_NOTIFICATIONS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
// What a due date means (overdue, notify moment, label) and the line that
// shows it. A task stores dueDate and, separately, an optional dueTime.
import { createDueDateChip, renderDueDateChip, isTaskOverdue, getDueMoment, normalizeDueTime, formatDueTime } from '../utils/dueDateUtils.js';
import { restoreFocusAfterClose, installDialogTabWrap } from '../ui/modalUtils.js';
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
 * The moments at which a due-date system notification should fire across
 * EVERY routine (a due date is a promise about that task, whichever routine
 * it lives in). A task with a due time fires at that time; one without fires
 * at `hour` local time on the due day, so all of a day's untimed tasks share
 * one notification. Tasks due at the same moment are grouped. Moments
 * already past are dropped — an overdue task gets the in-app banner on open,
 * never a repeat notification.
 *
 * @param {Object|null} state - Schema 2.6 state
 * @param {number} [now=Date.now()] - epoch ms
 * @param {number} [hour=LIMITS.DUE_DATE_NOTIFY_HOUR] - local hour for tasks with no due time
 * @returns {Array<{at:number, tasks:string[], timed:boolean}>} ascending by `at`;
 *   `timed` is true when every task in the slot has its own due time
 */
export function computeDueDateNotificationSlots(state, now = Date.now(), hour = LIMITS.DUE_DATE_NOTIFY_HOUR) {
    const routines = getRoutines(state) || {};
    const byMoment = new Map();
    for (const routine of Object.values(routines)) {
        for (const task of routine?.tasks || []) {
            if (!task?.dueDate || task.completed) continue;
            const at = getDueMoment(task, hour);
            if (!at) continue;
            const ts = at.getTime();
            if (ts <= now) continue;
            if (!byMoment.has(ts)) byMoment.set(ts, { tasks: [], timed: true });
            const slot = byMoment.get(ts);
            slot.tasks.push(task.text || getLabel('notify.dueDateUnnamed'));
            if (!normalizeDueTime(task.dueTime)) slot.timed = false;
        }
    }
    return [...byMoment.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([at, slot]) => ({ at, tasks: slot.tasks, timed: slot.timed }));
}

/**
 * Keep a recurring template's due date (and time) in step with its live task.
 *
 * The template is what the watcher recreates the task from, and until Oct
 * 2026 only recurring activation wrote its due date — so a date changed or
 * cleared on the task came back on the next occurrence. Priority already
 * synced this way (taskCRUD); due date was the one field left out.
 * @param {Object|null|undefined} routine - The draft routine inside AppState.update
 * @param {string} taskId
 * @param {string|null} dueDate - '' and undefined are stored as null
 * @param {string|null} [dueTime=null] - dropped when there is no date
 */
function syncTemplateDueDate(routine, taskId, dueDate, dueTime = null) {
    const template = routine?.recurringTemplates?.[taskId];
    if (!template) return;
    template.dueDate = dueDate || null;
    template.dueTime = dueDate ? normalizeDueTime(dueTime) : null;
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
            // Arm the plan from state NOW. The subscription only re-plans after
            // a write, and the afterApp hook below is no guarantee for a boot
            // that writes nothing: runHooks never replays for a hook added after
            // afterApp has run, and the hook bails while no task row is in the
            // DOM yet. Either race left a quiet boot with no 9:00 timer at all
            // until the user changed something (Oct 2026, WebKit CI: nothing
            // posted at 9:00 or an hour later). Idempotent, and a no-op until
            // state is ready.
            this.syncDueDateNotifications();

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
     * @param {string|null} [newDueTime=null] - "HH:MM", or null for a date-only due date
     * @returns {Promise<void>}
     */
    async saveTaskDueDate(taskId, newDueDate, newDueTime = null) {

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
                        taskToUpdate.dueTime = newDueDate ? normalizeDueTime(newDueTime) : null;
                    }
                    syncTemplateDueDate(getRoutine(state, activeCycle), taskId, newDueDate, newDueTime);
                }
            }, true);
        } catch (error) {
            console.error('❌ Error saving task due date:', error);
        }
    }

    /**
     * Check for overdue tasks: style their rows, keep their due-date lines
     * current ("Today" turns into "Yesterday" overnight), and announce the
     * ones that just became overdue.
     *
     * Everything is read from the task record in state, never from the row
     * (CLAUDE.md #14). Until Oct 2026 this read the inline date input, so a
     * task already checked off was still styled, labelled and announced as
     * overdue. A completed task is never shown as overdue now, but its
     * remembered overdue state is kept, so unchecking it again restores the
     * style without a second banner.
     * @param {HTMLElement|null} taskToCheck - Specific task row, or null for all rendered rows
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

        const activeCycleId = getActiveRoutineId(currentState);
        const cycleTasks = new Map(
            (getRoutine(currentState, activeCycleId)?.tasks || []).map(t => [t.id, t])
        );
        const now = new Date();

        tasks.forEach(task => {
            // ✅ FIX: Use task ID instead of task text for tracking (prevents issues when renaming tasks)
            const taskId = task.dataset?.taskId;
            const stateTask = taskId ? cycleTasks.get(taskId) : null;
            // A row with no record (a tour or demo row) is not ours to judge.
            if (!stateTask) return;

            renderDueDateChip(task.querySelector(DOM_SELECTORS.DUE_DATE), stateTask, now);

            const displayName = stateTask.text || task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent || getLabel('notify.dueDateUnnamed');
            const completed = stateTask.completed === true;

            if (!stateTask.dueDate) {
                // ✅ Date was cleared — remove overdue class, and the "Overdue"
                // accessible name with it (it outlived the date until Oct 2026)
                if (task.classList.contains(DOM_CLASSES.OVERDUE_TASK)) {
                    applyTaskStatusLabel(task, completed, { name: displayName });
                }
                task.classList.remove(DOM_CLASSES.OVERDUE_TASK);
                delete overdueTaskStates[taskId];
                return;
            }

            if (isTaskOverdue(stateTask, now)) {
                if (!overdueTaskStates[taskId]) {
                    newlyOverdueTasks.push(displayName); // Display text for notification
                }
                task.classList.add(DOM_CLASSES.OVERDUE_TASK);
                applyTaskStatusLabel(task, false,
                    { name: displayName, status: getLabel('nav.overdue') });
                overdueTaskStates[taskId] = true;
                return;
            }

            task.classList.remove(DOM_CLASSES.OVERDUE_TASK);
            // Restore the completion status rather than dropping the label.
            // removeAttribute() left every task with a FUTURE due date with no
            // accessible name at all — measured: "…, Not completed" became null
            // — so the row lost the one thing a screen reader needs from it.
            applyTaskStatusLabel(task, completed, { name: displayName });
            // Past due but checked off: keep the memory (see the doc comment).
            if (!(completed && isTaskOverdue({ ...stateTask, completed: false }, now))) {
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
     * Create the due-date line for a task row: a button reading "Today" or
     * "Today · 3:00 PM", hidden while the task has no due date. A tap opens
     * the picker. Keeps its historical DI name (it used to return an inline
     * <input type="date">).
     * @param {string} assignedTaskId - Task ID
     * @param {string|null} dueDate - "YYYY-MM-DD" or null
     * @param {boolean} autoResetEnabled - Unused; kept for the call signature
     * @param {Object} currentCycle - The routine the task belongs to (for its completion)
     * @param {string} activeCycle - Unused; kept for the call signature
     * @param {string|null} [dueTime=null] - "HH:MM" or null
     * @returns {HTMLButtonElement} The due-date line
     */
    createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle, dueTime = null) {
        const chip = createDueDateChip(assignedTaskId);
        chip.setAttribute('aria-describedby', `task-desc-${assignedTaskId}`);
        const completed = currentCycle?.tasks?.find(t => t.id === assignedTaskId)?.completed === true;
        renderDueDateChip(chip, { dueDate, dueTime, completed });
        return chip;
    }

    /**
     * Set up the complete due date system
     * Attaches event listeners and initializes visibility
     */
    setupDueDateSystem() {

        // The calendar button and the due-date line open the picker, for every
        // row, through ONE document listener. Capture phase: the option buttons
        // stop propagation in their own click handler (taskEvents).
        this.deps.safeAddEventListener(document, "click", this._handleDueDateClick, true);

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

        // ✅ Apply initial visibility state on load
        const autoReset = this.toggleAutoReset.checked;
        this.updateDueDateVisibility(autoReset);

    }

    // ============================================
    // DUE DATE PICKER
    // ============================================
    //
    // One shared <dialog>: a date field, an optional time field, Clear,
    // Cancel and Save. Opened from a task's calendar button or its due-date
    // line. Built once on first use; its listeners live as long as it does
    // and destroy() removes both.

    /**
     * The task record with this id in the active routine, or null.
     * @param {string} taskId
     * @returns {Object|null}
     */
    _findActiveTask(taskId) {
        const state = this._state();
        if (!state) return null;
        return getRoutine(state, getActiveRoutineId(state))?.tasks?.find(t => t.id === taskId) || null;
    }

    /**
     * Document click (capture): a task's calendar button or due-date line.
     * @param {MouseEvent} event
     */
    _handleDueDateClick = (event) => {
        const trigger = event.target?.closest?.(`${DOM_SELECTORS.SET_DUE_DATE}, ${DOM_SELECTORS.DUE_DATE}`);
        if (!trigger) return;
        const taskId = trigger.closest(DOM_SELECTORS.TASK)?.dataset?.taskId;
        if (!taskId || !this._findActiveTask(taskId)) return;
        this.openDueDatePicker(taskId, trigger);
    };

    /**
     * Build the picker dialog on first use.
     * @returns {HTMLDialogElement}
     */
    _ensurePicker() {
        if (this._picker?.isConnected) return this._picker;

        const dialog = document.createElement('dialog');
        dialog.id = DOM_IDS.DUE_DATE_PICKER;
        dialog.className = DOM_CLASSES.DUE_DATE_PICKER_OVERLAY;
        dialog.setAttribute('data-modal', '');
        dialog.setAttribute('aria-labelledby', DOM_IDS.DUE_DATE_PICKER_TITLE);

        const form = document.createElement('form');
        form.className = DOM_CLASSES.DUE_DATE_PICKER;

        const title = document.createElement('h3');
        title.id = DOM_IDS.DUE_DATE_PICKER_TITLE;
        title.textContent = getLabel('dueDate.pickerTitle');
        form.appendChild(title);

        const taskName = document.createElement('p');
        taskName.id = DOM_IDS.DUE_DATE_PICKER_TASK;
        form.appendChild(taskName);
        dialog.setAttribute('aria-describedby', DOM_IDS.DUE_DATE_PICKER_TASK);

        const makeField = (id, type, labelKey) => {
            const label = document.createElement('label');
            label.className = DOM_CLASSES.DUE_DATE_PICKER_FIELD;
            label.htmlFor = id;
            label.textContent = getLabel(labelKey);
            const input = document.createElement('input');
            input.type = type;
            input.id = id;
            input.name = id;
            label.appendChild(input);
            form.appendChild(label);
            return input;
        };
        const dateInput = makeField(DOM_IDS.DUE_DATE_PICKER_DATE, 'date', 'dueDate.dateLabel');
        const timeInput = makeField(DOM_IDS.DUE_DATE_PICKER_TIME, 'time', 'dueDate.timeLabel');

        const hint = document.createElement('p');
        const notifyHour = `${String(LIMITS.DUE_DATE_NOTIFY_HOUR).padStart(2, '0')}:00`;
        hint.textContent = getLabel('dueDate.timeHint', { vars: { time: formatDueTime(notifyHour) } });
        form.appendChild(hint);

        const actions = document.createElement('div');
        actions.className = DOM_CLASSES.DUE_DATE_PICKER_ACTIONS;
        const makeButton = (type, labelKey, className = '') => {
            const button = document.createElement('button');
            button.type = type;
            button.textContent = getLabel(labelKey);
            if (className) button.className = className;
            actions.appendChild(button);
            return button;
        };
        const clearButton = makeButton('button', 'dueDate.clear', DOM_CLASSES.DUE_DATE_PICKER_CLEAR);
        const cancelButton = makeButton('button', 'button.cancel');
        makeButton('submit', 'button.save');
        form.appendChild(actions);
        dialog.appendChild(form);

        this._pickerHandlers = {
            submit: (event) => {
                event.preventDefault();
                this._savePicker(dateInput.value || null, timeInput.value || null);
            },
            clear: () => this._savePicker(null, null),
            cancel: () => dialog.close(),
            backdrop: (event) => { if (event.target === dialog) dialog.close(); },
            close: () => {
                const row = this._pickerTaskId
                    ? this.deps.querySelectorAll(DATA_SELECTORS.taskById(this._pickerTaskId))[0]
                    : null;
                this._pickerTaskId = null;
                restoreFocusAfterClose(dialog, { fallbacks: [row?.querySelector(DOM_SELECTORS.TASK_TEXT)] });
            }
        };
        form.addEventListener('submit', this._pickerHandlers.submit);
        clearButton.addEventListener('click', this._pickerHandlers.clear);
        cancelButton.addEventListener('click', this._pickerHandlers.cancel);
        dialog.addEventListener('click', this._pickerHandlers.backdrop);
        dialog.addEventListener('close', this._pickerHandlers.close);
        installDialogTabWrap(dialog);

        this._pickerParts = { form, taskName, dateInput, timeInput, clearButton, cancelButton };
        document.body.appendChild(dialog);
        this._picker = dialog;
        return dialog;
    }

    /**
     * Open the picker for a task in the active routine.
     * @param {string} taskId
     * @param {HTMLElement|null} [opener=null] - gets focus back on close
     * @returns {void}
     */
    openDueDatePicker(taskId, opener = null) {
        const task = this._findActiveTask(taskId);
        if (!task) return;
        const dialog = this._ensurePicker();
        const { taskName, dateInput, timeInput, clearButton } = this._pickerParts;

        this._pickerTaskId = taskId;
        taskName.textContent = task.text || getLabel('notify.dueDateUnnamed');
        // Only a "YYYY-MM-DD" string is a value a date input accepts.
        dateInput.value = parseDateAsLocal(task.dueDate) ? task.dueDate : '';
        timeInput.value = normalizeDueTime(task.dueTime) || '';
        clearButton.classList.toggle(DOM_CLASSES.HIDDEN, !task.dueDate);

        dialog._previousFocus = opener || document.activeElement;
        if (!dialog.open) dialog.showModal();
        dateInput.focus();
    }

    /**
     * Close the picker and apply what it holds.
     * @param {string|null} date
     * @param {string|null} time
     * @returns {Promise<void>}
     */
    async _savePicker(date, time) {
        const taskId = this._pickerTaskId;
        if (this._picker?.open) this._picker.close();
        if (taskId) await this.applyTaskDueDate(taskId, date, time);
    }

    /**
     * Set or clear a task's due date and time, then refresh what shows it.
     * A time without a date is dropped. No-op when nothing changed.
     * @param {string} taskId
     * @param {string|null} date - "YYYY-MM-DD" or null to clear
     * @param {string|null} [time=null] - "HH:MM" or null
     * @returns {Promise<void>}
     */
    async applyTaskDueDate(taskId, date, time = null) {
        const before = this._findActiveTask(taskId);
        if (!before) return;
        const newDate = date || null;
        const newTime = newDate ? normalizeDueTime(time) : null;
        if ((before.dueDate || null) === newDate && normalizeDueTime(before.dueTime) === newTime) return;

        await this.saveTaskDueDate(taskId, newDate, newTime);

        this.deps.updateStatsPanel();
        this.deps.updateProgressBar();
        this.deps.checkCompleteAllButton();

        const taskText = before.text || getLabel('notify.dueDateUnnamed');
        if (newDate) {
            this.deps.showNotification("📅 " + getLabel('notify.dueDateUpdated', { vars: { name: taskText } }), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            // Auto-enable due date notifications when a due date is set
            this._autoEnableDueDateReminders();
        } else {
            this.deps.showNotification("📅 " + getLabel('notify.dueDateCleared', { vars: { name: taskText } }), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
        }

        const row = this.deps.querySelectorAll(DATA_SELECTORS.taskById(taskId))[0];
        if (row) await this.checkOverdueTasks(row);

        this._announceDueSoon(taskText, newDate);
    }

    /**
     * The in-app "due soon" banner, for a date within the next three days,
     * when due-date notices are on.
     * @param {string} taskText
     * @param {string|null} dueDate
     * @returns {void}
     */
    _announceDueSoon(taskText, dueDate) {
        if (!dueDate) return;
        const state = this._state();
        const reminders = state?.customReminders || DEFAULT_REMINDERS;
        if (!reminders.dueDatesReminders) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Local-midnight parse — see the import note; new Date() here fired
        // the due-soon reminder a day early in negative UTC offsets.
        const selectedDate = parseDateAsLocal(dueDate);
        if (!selectedDate) return;

        // Only show "due soon" if the date is within the next 3 days
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const daysUntilDue = selectedDate - today;

        if (daysUntilDue > 0 && daysUntilDue <= threeDaysMs) {
            this.deps.showNotification("📅 " + getLabel('notify.dueDateDueSoon', { vars: { name: taskText } }), "default");
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
     * Title and body for one due-date slot ("due now" when every task in it
     * has its own due time, else "due today").
     * @param {{at:number, tasks:string[], timed?:boolean}} slot
     * @returns {{title:string, body:string}}
     */
    _dueDateSlotContent(slot) {
        const titleKey = slot.timed ? 'notify.dueDateNotificationTitleTimed' : 'notify.dueDateNotificationTitle';
        return {
            title: getLabel(titleKey, { count: slot.tasks.length }),
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

        // Due date reminders option: only relevant when reminders are meaningful
        // (kept visible in all modes so users can configure)

        // Re-render every due-date line from state (shown only for a task with
        // a date, in all modes) and reapply overdue classes as needed.
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
        document.removeEventListener("click", this._handleDueDateClick, true);
        if (this._picker) {
            const { form, clearButton, cancelButton } = this._pickerParts;
            form.removeEventListener('submit', this._pickerHandlers.submit);
            clearButton.removeEventListener('click', this._pickerHandlers.clear);
            cancelButton.removeEventListener('click', this._pickerHandlers.cancel);
            this._picker.removeEventListener('click', this._pickerHandlers.backdrop);
            this._picker.removeEventListener('close', this._pickerHandlers.close);
            if (this._picker._tabWrapHandler) {
                this._picker.removeEventListener('keydown', this._picker._tabWrapHandler);
            }
            if (this._picker.open) this._picker.close();
            this._picker.remove();
            this._picker = null;
            this._pickerParts = null;
            this._pickerHandlers = null;
        }
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
