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

// SVG icons for task buttons (Font Awesome style)
// Each icon has explicit fill color matching the button type
const TASK_ICONS = {
    'exclamation-triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="#bf0303" d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S480.9 480 466.7 480H45.3c-14.2 0-27.3-7.5-34.5-19.8s-7.3-27.7-.2-40.1l216-368C233.9 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>',
    'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="#333333" d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></svg>',
    'trash': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 448 512"><path fill="#333333" d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>',
    'repeat': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="#0056b3" d="M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96H320v32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32V64H160C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96H192V352c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V448H352c88.4 0 160-71.6 160-160z"/></svg>',
    'calendar-alt': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 448 512"><path fill="#555555" d="M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v16 48V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192 144 128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM48 192H400V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192z"/></svg>',
    'bell': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 448 512"><path fill="#333333" d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/></svg>'
};

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
            // Extract icon name from FA class (e.g., "fas fa-trash" -> "trash")
            const iconName = iconClass.split(' ').find(c => c.startsWith('fa-') && c !== 'fa-solid')?.replace('fa-', '');

            if (iconName && TASK_ICONS[iconName]) {
                // Create wrapper span
                const iconSpan = document.createElement('span');
                iconSpan.className = 'icon';
                iconSpan.setAttribute('aria-hidden', 'true');

                // Parse SVG string and create proper namespaced elements
                const template = document.createElement('template');
                template.innerHTML = TASK_ICONS[iconName].trim();
                const svgNode = template.content.firstChild;

                if (svgNode) {
                    iconSpan.appendChild(svgNode);
                }
                button.appendChild(iconSpan);
            } else {
                // Fallback to emoji if no SVG found
                const fallbackText = {
                    'exclamation-triangle': '⚠',
                    'edit': '✎',
                    'trash': '🗑',
                    'repeat': '↻',
                    'calendar-alt': '📅',
                    'bell': '🔔'
                };
                button.textContent = fallbackText[iconName] || '?';
            }
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
            "delete-when-complete-btn": "Marked for removal (removes task on reset or clear)"
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
