/**
 * miniCycle Task Buttons Module
 *
 * Handles creation and setup of task button containers and individual buttons.
 * Extracted from taskDOM.js to reduce file size and improve maintainability.
 *
 * Features:
 * - Button container creation with visibility settings
 * - Individual button creation with icons
 * - Accessibility setup (ARIA labels, keyboard navigation)
 * - Button event handler wiring
 * - Delete-when-complete button logic
 *
 * @module task/taskButtons
 * @version 1.0.0
 * @see {@link module:task/taskDOM} - Parent module that uses this
 */

import { createDIModule, optional } from '../core/diBase.js';

// Default delete-when-complete settings (imported where needed)
const DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS = {
    cycle: true,
    todo: false
};

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskButtons', {
    AppState: optional(null),
    safeAddEventListener: optional(null),
    showNotification: optional(null),
    taskOptionsCustomizer: optional(null),
    setupRecurringButtonHandler: optional(null),
    setupReminderButtonHandler: optional(null),
    handleTaskButtonClick: optional(null),
    GlobalUtils: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null)
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null, safeAddEventListener: Function|null, showNotification: Function|null, taskOptionsCustomizer: Object|null, setupRecurringButtonHandler: Function|null, setupReminderButtonHandler: Function|null, handleTaskButtonClick: Function|null, GlobalUtils: Object|null, DEFAULT_TASK_OPTION_BUTTONS: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskButtons
 * @param {Object} dependencies - Dependencies to inject
 */
export function setTaskButtonsDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🔘 TaskButtons dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// TASK BUTTONS CLASS
// ============================================================================

export class TaskButtons {
    constructor(dependencies = {}) {
        this.deps = di.resolve(dependencies);
        console.log('🔘 TaskButtons created');
    }

    /**
     * Create task button container with all buttons
     * @param {Object} taskContext - Task context with settings and state
     * @returns {HTMLDivElement} Button container element
     */
    createTaskButtonContainer(taskContext) {
        const {
            autoResetEnabled, deleteCheckedEnabled, settings,
            remindersEnabled, remindersEnabledGlobal, assignedTaskId,
            currentCycle, recurring, highPriority
        } = taskContext;

        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("task-options");

        // If three dots mode is enabled, ensure buttons start explicitly HIDDEN
        const threeDotsEnabled = settings.showThreeDots || false;
        if (threeDotsEnabled) {
            buttonContainer.style.visibility = "hidden";
            buttonContainer.style.opacity = "0";
            buttonContainer.style.pointerEvents = "none";
        }

        // Get button visibility settings for this cycle
        const visibleOptions = currentCycle.taskOptionButtons || this.deps.DEFAULT_TASK_OPTION_BUTTONS || {};

        // Always show customize button first
        const customizeBtn = this.createCustomizeButton();
        buttonContainer.appendChild(customizeBtn);

        // Button configuration with visibility checks
        const buttons = [
            { class: "move-up", icon: "▲", show: true },
            { class: "move-down", icon: "▼", show: true },
            { class: "priority-btn", iconClass: "fas fa-exclamation-triangle", show: visibleOptions.highPriority ?? true },
            { class: "edit-btn", iconClass: "fas fa-edit", show: visibleOptions.rename ?? true },
            { class: "delete-btn", iconClass: "fas fa-trash", show: visibleOptions.delete ?? true },
            { class: "recurring-btn", iconClass: "fas fa-repeat", show: visibleOptions.recurring ?? false },
            { class: "set-due-date", iconClass: "fas fa-calendar-alt", show: visibleOptions.dueDate ?? false },
            { class: "enable-task-reminders", iconClass: "fas fa-bell", show: visibleOptions.reminders ?? false, toggle: true },
            { class: "delete-when-complete-btn", icon: "❌", show: visibleOptions.deleteWhenComplete ?? false, toggle: true }
        ];

        buttons.forEach(buttonConfig => {
            const button = this.createTaskButton(buttonConfig, taskContext, buttonContainer);
            buttonContainer.appendChild(button);
        });

        return buttonContainer;
    }

    /**
     * Create the customize button (opens task options customization modal)
     * @returns {HTMLButtonElement} The customize button element
     */
    createCustomizeButton() {
        const button = document.createElement("button");
        button.classList.add("task-btn", "customize-btn");
        button.textContent = "-/+";
        button.setAttribute("type", "button");
        button.setAttribute("title", "Customize task options");
        button.setAttribute("tabindex", "0");
        button.setAttribute("aria-label", "Customize which task option buttons are visible");

        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => el.addEventListener(ev, fn));

        button._clickHandler = (e) => {
            e.stopPropagation();
            const customizer = this.deps.taskOptionsCustomizer;
            if (customizer) {
                const state = this.deps.AppState?.get?.();
                const activeCycleId = state?.appState?.activeCycleId;
                if (activeCycleId) {
                    customizer.showCustomizationModal(activeCycleId);
                } else {
                    console.warn('⚠️ No active cycle ID found');
                }
            } else {
                console.warn('⚠️ TaskOptionsCustomizer not injected');
            }
        };
        safeAdd(button, "click", button._clickHandler);

        button._keydownHandler = (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                button.click();
            }
        };
        safeAdd(button, "keydown", button._keydownHandler);

        return button;
    }

    /**
     * Create individual task button
     * @param {Object} buttonConfig - Button configuration
     * @param {Object} taskContext - Task context
     * @param {HTMLElement} buttonContainer - Parent container
     * @returns {HTMLButtonElement} The button element
     */
    createTaskButton(buttonConfig, taskContext, buttonContainer) {
        const { class: btnClass, icon, iconClass, toggle = false, show } = buttonConfig;
        const { assignedTaskId, currentCycle, settings, remindersEnabled, recurring, highPriority, deleteWhenComplete } = taskContext;

        const button = document.createElement("button");
        button.classList.add("task-btn", btnClass);

        if (iconClass) {
            const iconEl = document.createElement("i");
            iconClass.split(" ").forEach(cls => iconEl.classList.add(cls));
            button.appendChild(iconEl);
        } else if (icon) {
            button.textContent = icon;
        }

        button.setAttribute("type", "button");

        // Move arrows don't use .hidden - visibility controlled by CSS
        if (btnClass !== "move-up" && btnClass !== "move-down" && !show) {
            button.classList.add("hidden");
        }

        this.setupButtonAccessibility(button, btnClass, buttonContainer);
        this.setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle, deleteWhenComplete);
        this.setupButtonEventHandlers(button, btnClass, taskContext);

        return button;
    }

    /**
     * Setup button accessibility (keyboard navigation, ARIA labels)
     * @param {HTMLButtonElement} button - The button element
     * @param {string} btnClass - Button class name
     * @param {HTMLElement} buttonContainer - Parent container
     */
    setupButtonAccessibility(button, btnClass, buttonContainer) {
        button.setAttribute("tabindex", "0");

        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => el.addEventListener(ev, fn));

        button._accessibilityKeydownHandler = (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                button.click();
            }

            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const focusable = Array.from(buttonContainer.querySelectorAll("button.task-btn"));
                const currentIndex = focusable.indexOf(e.target);
                const nextIndex = e.key === "ArrowRight"
                    ? (currentIndex + 1) % focusable.length
                    : (currentIndex - 1 + focusable.length) % focusable.length;
                focusable[nextIndex].focus();
                e.preventDefault();
            }
        };
        safeAdd(button, "keydown", button._accessibilityKeydownHandler);

        const ariaLabels = {
            "move-up": "Move task up",
            "move-down": "Move task down",
            "recurring-btn": "Toggle recurring task",
            "set-due-date": "Set due date",
            "enable-task-reminders": "Toggle reminders for this task",
            "priority-btn": "Mark task as high priority",
            "edit-btn": "Edit task",
            "delete-btn": "Delete task",
            "delete-when-complete-btn": "Toggle delete when complete (permanently remove on auto-reset)"
        };
        const label = ariaLabels[btnClass] || "Task action";
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
    }

    /**
     * Setup button ARIA states (pressed, active)
     * @param {HTMLButtonElement} button - The button element
     * @param {string} btnClass - Button class name
     * @param {boolean} remindersEnabled - Whether reminders are enabled
     * @param {boolean} recurring - Whether task is recurring
     * @param {boolean} highPriority - Whether task is high priority
     * @param {string} assignedTaskId - Task ID
     * @param {Object} currentCycle - Current cycle data
     * @param {boolean} deleteWhenComplete - Delete when complete state
     */
    setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle, deleteWhenComplete) {
        if (btnClass === "enable-task-reminders") {
            const isActive = remindersEnabled === true;
            button.classList.toggle("reminder-active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        } else if (btnClass === "delete-when-complete-btn") {
            const isActive = deleteWhenComplete === true;
            button.classList.toggle("active", isActive);
            button.classList.toggle("delete-when-complete-active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        } else if (["recurring-btn", "priority-btn"].includes(btnClass)) {
            let isActive;

            if (btnClass === "recurring-btn") {
                const hasRecurringTemplate = currentCycle?.recurringTemplates?.[assignedTaskId];
                isActive = hasRecurringTemplate || !!recurring;
            } else {
                isActive = !!highPriority;
            }

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        }
    }

    /**
     * Setup button event handlers
     * @param {HTMLButtonElement} button - The button element
     * @param {string} btnClass - Button class name
     * @param {Object} taskContext - Task context
     */
    setupButtonEventHandlers(button, btnClass, taskContext) {
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => el.addEventListener(ev, fn));

        if (btnClass === "recurring-btn") {
            if (typeof this.deps.setupRecurringButtonHandler === 'function') {
                this.deps.setupRecurringButtonHandler(button, taskContext);
            }
        } else if (btnClass === "enable-task-reminders") {
            if (typeof this.deps.setupReminderButtonHandler === 'function') {
                this.deps.setupReminderButtonHandler(button, taskContext);
            }
        } else if (btnClass === "delete-when-complete-btn") {
            this.setupDeleteWhenCompleteButtonHandler(button, taskContext);
        } else if (btnClass === "move-up" || btnClass === "move-down") {
            // Skip - using event delegation
        } else {
            if (typeof this.deps.handleTaskButtonClick === 'function') {
                safeAdd(button, "click", this.deps.handleTaskButtonClick);
            }
        }
    }

    /**
     * Setup delete-when-complete button handler
     * @param {HTMLButtonElement} button - The button element
     * @param {Object} taskContext - Task context
     */
    setupDeleteWhenCompleteButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => el.addEventListener(ev, fn));

        button._deleteWhenCompleteClickHandler = async (e) => {
            e.stopPropagation();

            const taskItem = button.closest(".task");
            if (!taskItem) {
                console.warn('⚠️ Task item not found for delete-when-complete button');
                return;
            }

            const isRecurring = taskItem.classList.contains("recurring");
            const currentlyActive = button.classList.contains("delete-when-complete-active");
            const newState = !currentlyActive;

            if (isRecurring && !newState) {
                this.deps.showNotification?.(
                    "📌 This recurring task will be kept on reset instead of respawning.",
                    "info",
                    3000
                );
            }

            if (!this.deps.AppState?.isReady?.()) {
                console.error('❌ AppState not available for delete-when-complete toggle');
                this.deps.showNotification?.('Feature temporarily unavailable', 'error', 3000);
                return;
            }

            let state = this.deps.AppState.get();
            let activeCycleId = state.appState.activeCycleId;
            let cycle = state.data.cycles[activeCycleId];
            let isToDoMode = cycle?.deleteCheckedTasks === true;
            const currentMode = isToDoMode ? 'todo' : 'cycle';

            await this.deps.AppState.update(state => {
                const cycle = state.data.cycles[activeCycleId];
                const task = cycle?.tasks?.find(t => t.id === assignedTaskId);

                if (task) {
                    const isValid = this.deps.GlobalUtils?.validateDeleteSettings(task.deleteWhenCompleteSettings);
                    if (!isValid) {
                        task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                    }

                    task.deleteWhenComplete = newState;
                    task.deleteWhenCompleteSettings[currentMode] = newState;
                }
            }, true);

            state = this.deps.AppState.get();
            const task = state.data.cycles[activeCycleId]?.tasks?.find(t => t.id === assignedTaskId);

            if (task) {
                if (this.deps.GlobalUtils) {
                    this.deps.GlobalUtils.syncTaskDeleteWhenCompleteDOM(
                        taskItem,
                        task,
                        currentMode,
                        { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
                    );
                } else {
                    // Fallback: manual DOM update
                    taskItem.dataset.deleteWhenComplete = newState.toString();
                    taskItem.dataset.deleteWhenCompleteSettings = JSON.stringify(task.deleteWhenCompleteSettings);
                    button.classList.toggle("active", newState);
                    button.classList.toggle("delete-when-complete-active", newState);
                    button.setAttribute("aria-pressed", newState.toString());

                    if (isToDoMode) {
                        taskItem.classList.remove('show-delete-indicator');
                        taskItem.classList.toggle('kept-task', !newState);
                    } else {
                        if (newState && !isRecurring) {
                            taskItem.classList.add('show-delete-indicator');
                            taskItem.classList.remove('kept-task');
                        } else {
                            taskItem.classList.remove('show-delete-indicator');
                            if (!newState && isRecurring) {
                                taskItem.classList.add('kept-task');
                            } else {
                                taskItem.classList.remove('kept-task');
                            }
                        }
                    }
                }
            }

            let message;
            if (newState) {
                message = "Task will be removed on auto-reset";
            } else {
                message = isToDoMode
                    ? "📌 Task will be kept on complete (pinned)"
                    : "Task will remain in list on auto-reset";
            }
            this.deps.showNotification?.(message, "info", 2000);
        };
        safeAdd(button, "click", button._deleteWhenCompleteClickHandler);
    }

    /**
     * Handle disabling recurring for a task
     * @param {string} assignedTaskId - Task ID
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {HTMLElement} button - Delete-when-complete button
     */
    async handleDisableRecurringForTask(assignedTaskId, taskItem, button) {
        if (!this.deps.AppState?.isReady?.()) return;

        await this.deps.AppState.update(state => {
            const cid = state.appState.activeCycleId;
            const cycle = state.data.cycles[cid];

            if (cycle?.recurringTemplates?.[assignedTaskId]) {
                delete cycle.recurringTemplates[assignedTaskId];
            }

            const task = cycle?.tasks?.find(t => t.id === assignedTaskId);
            if (task) {
                task.recurring = false;

                if (!task.deleteWhenCompleteSettings) {
                    task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                }

                const isToDoMode = cycle?.deleteCheckedTasks === true;
                const currentMode = isToDoMode ? 'todo' : 'cycle';
                task.deleteWhenComplete = task.deleteWhenCompleteSettings[currentMode];
            }
        }, true);

        const state = this.deps.AppState.get();
        const cid = state.appState.activeCycleId;
        const cycle = state.data.cycles[cid];
        const task = cycle?.tasks?.find(t => t.id === assignedTaskId);
        const isToDoMode = cycle?.deleteCheckedTasks === true;
        const currentMode = isToDoMode ? 'todo' : 'cycle';

        taskItem.classList.remove("recurring");

        const recurringBtn = taskItem.querySelector(".recurring-btn");
        if (recurringBtn) {
            recurringBtn.classList.remove("active");
            recurringBtn.setAttribute("aria-pressed", "false");
        }

        if (task && this.deps.GlobalUtils) {
            this.deps.GlobalUtils.syncTaskDeleteWhenCompleteDOM(
                taskItem,
                task,
                currentMode,
                { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
            );
        }

        this.deps.showNotification?.("Recurring disabled for this task", "info", 2000);
    }
}

// ============================================================================
// MODULE INSTANCE MANAGEMENT
// ============================================================================

let taskButtonsInstance = null;

/**
 * Initialize the TaskButtons singleton
 * @param {Object} dependencies - Dependencies to inject
 * @returns {TaskButtons} The TaskButtons instance
 */
export function initTaskButtons(dependencies = {}) {
    if (taskButtonsInstance) {
        console.warn('⚠️ TaskButtons already initialized');
        return taskButtonsInstance;
    }
    taskButtonsInstance = new TaskButtons(dependencies);
    return taskButtonsInstance;
}

/**
 * Get the TaskButtons instance
 * @returns {TaskButtons|null} The TaskButtons instance or null
 */
export function getTaskButtons() {
    return taskButtonsInstance;
}

console.log('🔘 TaskButtons module loaded');
