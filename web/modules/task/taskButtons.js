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
import { DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS, DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { handleHorizontalArrowNav } from '../utils/keyboardNav.js';
import { syncTaskDeleteWhenComplete, getDeleteSettingsMode } from '../utils/cycleMode.js';
import { createIconElement } from '../utils/icons.js';

// SVG icons for task buttons (Font Awesome style)
// Colors controlled by CSS via fill="currentColor" - see task-options.css
// Task-option icons come from the central registry (utils/icons.js) via
// createIconElement(). A local TASK_ICONS map used to duplicate six of them here
// with a weaker <template>.innerHTML parse; the registry uses DOMParser, which
// handles SVG namespacing properly. Verified byte-identical before removal —
// same viewBox and same path data for all six — and `.task-btn .icon svg` in
// icons.css already pins 14x14, so the inline width/height the local copies
// carried were redundant.

// DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS imported from constants.js

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
 * @returns {void}
 */
export function setTaskButtonsDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// TASK BUTTONS CLASS
// ============================================================================

export class TaskButtons {
    constructor(dependencies = {}) {
        this.deps = di.resolve(dependencies);
    }

    /**
     * Create task button container with all buttons.
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
        buttonContainer.classList.add(DOM_CLASSES.TASK_OPTIONS);

        // If three dots mode is enabled, ensure buttons start explicitly HIDDEN via CSS class
        // (base .task-options CSS already has visibility: hidden; this adds explicit force-hidden)
        const threeDotsEnabled = settings.showThreeDots || false;
        if (threeDotsEnabled) {
            buttonContainer.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
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
            { class: "priority-btn", iconClass: "fas fa-flag", show: visibleOptions.highPriority ?? true },
            { class: "edit-btn", iconClass: "fas fa-edit", show: visibleOptions.rename ?? true },
            { class: "recurring-btn", iconClass: "fas fa-repeat", show: visibleOptions.recurring ?? false },
            { class: "set-due-date", iconClass: "fas fa-calendar-alt", show: visibleOptions.dueDate ?? false },
            { class: "enable-task-reminders", iconClass: "fas fa-bell", show: visibleOptions.reminders ?? false, toggle: true },
            { class: "delete-btn", iconClass: "fas fa-trash", show: visibleOptions.delete ?? true },
            { class: "delete-when-complete-btn", icon: "🧹", show: visibleOptions.deleteWhenComplete ?? false, toggle: true }
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
        button.classList.add(DOM_CLASSES.TASK_BTN, DOM_CLASSES.CUSTOMIZE_BTN);
        button.textContent = "+/-";
        button.setAttribute("type", "button");
        button.setAttribute("title", getLabel('taskOption.customize'));
        button.setAttribute("tabindex", "-1");
        button.setAttribute("aria-label", getLabel('taskOption.customizeAria'));

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
     * Create individual task button.
     * @param {Object} buttonConfig - Button configuration
     * @param {Object} taskContext - Task context
     * @param {HTMLElement} buttonContainer - Parent container
     * @returns {HTMLButtonElement} The button element
     */
    createTaskButton(buttonConfig, taskContext, buttonContainer) {
        const { class: btnClass, icon, iconClass, toggle = false, show } = buttonConfig;
        const { assignedTaskId, currentCycle, settings, remindersEnabled, recurring, highPriority, deleteWhenComplete } = taskContext;

        const button = document.createElement("button");
        button.classList.add(DOM_CLASSES.TASK_BTN, btnClass);

        if (iconClass) {
            // Extract icon name from FA class (e.g., "fas fa-trash" -> "trash")
            const iconName = iconClass.split(' ').find(c => c.startsWith('fa-') && c !== 'fa-solid')?.replace('fa-', '');

            if (iconName) {
                // createIconElement builds the same <span class="icon" aria-hidden>
                // wrapper, but parses via DOMParser and warns on an unknown name
                // instead of silently rendering nothing.
                button.appendChild(createIconElement(iconName));
            } else {
                // Fallback to emoji if no SVG found
                const fallbackText = {
                    'flag': '🚩',
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
            button.classList.add(DOM_CLASSES.HIDDEN);
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
     * @returns {void}
     */
    setupButtonAccessibility(button, btnClass, buttonContainer) {
        button.setAttribute("tabindex", "-1");

        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => el.addEventListener(ev, fn));

        button._accessibilityKeydownHandler = (e) => {
            if (e.key === " ") {
                // Space: prevent scroll and trigger click immediately
                // (native Space activation fires on keyup — too late for user feedback)
                e.preventDefault();
                button.click();
            }
            // Enter: native <button> activation handles the click — no manual trigger needed

            handleHorizontalArrowNav(e, buttonContainer, 'button.task-btn', {
                wrap: true,
                skipHidden: true
            });

            if (e.key === "Escape") {
                e.preventDefault();
                // Hide options (mirrors TaskOptionsVisibilityController.hide)
                buttonContainer.classList.remove(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
                buttonContainer.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
                buttonContainer.querySelectorAll('button.task-btn').forEach(btn => {
                    btn.tabIndex = -1;
                });
                // Return focus to task label
                const taskItem = button.closest(DOM_SELECTORS.TASK);
                const label = taskItem?.querySelector(DOM_SELECTORS.TASK_TEXT);
                label?.focus();
            }
        };
        safeAdd(button, "keydown", button._accessibilityKeydownHandler);

        const ariaLabelKeys = {
            "move-up": 'taskOption.moveUp',
            "move-down": 'taskOption.moveDown',
            "recurring-btn": 'taskOption.recurring',
            "set-due-date": 'taskOption.dueDate',
            "enable-task-reminders": 'taskOption.reminders',
            "priority-btn": 'taskOption.priority',
            "edit-btn": 'taskOption.edit',
            "delete-btn": 'taskOption.delete'
        };

        // Mode-aware label for delete-when-complete button
        let labelKey = ariaLabelKeys[btnClass];
        if (btnClass === 'delete-when-complete-btn') {
            const state = this.deps.AppState?.get?.();
            const activeCycle = state?.data?.cycles?.[state?.appState?.activeCycleId];
            const isToDoMode = activeCycle?.deleteCheckedTasks === true;
            labelKey = isToDoMode ? 'taskOption.markedForClearing' : 'taskOption.clearOnReset';
        }
        const label = labelKey ? getLabel(labelKey) : getLabel('taskOption.showOptions');
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
     * @returns {void}
     */
    setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle, deleteWhenComplete) {
        if (btnClass === "enable-task-reminders") {
            const isActive = remindersEnabled === true;
            button.classList.toggle(DOM_CLASSES.REMINDER_ACTIVE, isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        } else if (btnClass === "delete-when-complete-btn") {
            const isActive = deleteWhenComplete === true;
            button.classList.toggle(DOM_CLASSES.ACTIVE, isActive);
            button.classList.toggle(DOM_CLASSES.DELETE_WHEN_COMPLETE_ACTIVE, isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        } else if (btnClass === "set-due-date") {
            // Due date button shows/hides an input — use aria-expanded
            button.setAttribute("aria-expanded", "false");
        } else if (["recurring-btn", "priority-btn"].includes(btnClass)) {
            let isActive;

            if (btnClass === "recurring-btn") {
                const hasRecurringTemplate = currentCycle?.recurringTemplates?.[assignedTaskId];
                // Coerce to boolean: hasRecurringTemplate is the template OBJECT, so a bare
                // `template || !!recurring` left isActive as the object and
                // isActive.toString() produced the invalid aria-pressed="[object Object]".
                isActive = !!hasRecurringTemplate || !!recurring;
            } else {
                isActive = !!highPriority;
            }

            button.classList.toggle(DOM_CLASSES.ACTIVE, isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        }
    }

    /**
     * Setup button event handlers
     * @param {HTMLButtonElement} button - The button element
     * @param {string} btnClass - Button class name
     * @param {Object} taskContext - Task context
     * @returns {void}
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
     * @returns {void}
     */
    setupDeleteWhenCompleteButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => el.addEventListener(ev, fn));

        button._deleteWhenCompleteClickHandler = async (e) => {
            e.stopPropagation();

            const taskItem = button.closest(DOM_SELECTORS.TASK);
            if (!taskItem) {
                console.warn('⚠️ Task item not found for delete-when-complete button');
                return;
            }

            const isRecurring = taskItem.classList.contains(DOM_CLASSES.RECURRING);
            const currentlyActive = button.classList.contains(DOM_CLASSES.DELETE_WHEN_COMPLETE_ACTIVE);
            const newState = !currentlyActive;

            if (isRecurring && !newState) {
                this.deps.showNotification?.(
                    `📌 ${getLabel('notify.recurringKeptOnReset')}`,
                    "info",
                    UI_TIMEOUTS.NOTIFICATION_LONG
                );
            }

            if (!this.deps.AppState?.isReady?.()) {
                console.error('❌ AppState not available for delete-when-complete toggle');
                this.deps.showNotification?.(getLabel('notify.featureUnavailable'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                return;
            }

            // Fix #52: Read state inside update callback to avoid TOCTOU race
            let currentMode;

            await this.deps.AppState.update(state => {
                const activeCycleId = state.appState.activeCycleId;
                const cycle = state.data.cycles[activeCycleId];
                const task = cycle?.tasks?.find(t => t.id === assignedTaskId);

                if (!task) return;

                // Determine mode inside callback with fresh state
                const isToDoMode = cycle?.deleteCheckedTasks === true;
                currentMode = isToDoMode ? 'todo' : 'cycle';

                const isValid = this.deps.GlobalUtils?.validateDeleteSettings(task.deleteWhenCompleteSettings);
                if (!isValid) {
                    task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                }

                task.deleteWhenComplete = newState;
                task.deleteWhenCompleteSettings[currentMode] = newState;
            }, true);

            // Re-read for DOM sync
            const state = this.deps.AppState.get();
            const activeCycleId = state.appState.activeCycleId;
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
                    button.classList.toggle(DOM_CLASSES.ACTIVE, newState);
                    button.classList.toggle(DOM_CLASSES.DELETE_WHEN_COMPLETE_ACTIVE, newState);
                    button.setAttribute("aria-pressed", newState.toString());

                    if (currentMode === 'todo') {
                        taskItem.classList.remove(DOM_CLASSES.SHOW_DELETE_INDICATOR);
                        taskItem.classList.toggle(DOM_CLASSES.KEPT_TASK, !newState);
                    } else {
                        if (newState && !isRecurring) {
                            taskItem.classList.add(DOM_CLASSES.SHOW_DELETE_INDICATOR);
                            taskItem.classList.remove(DOM_CLASSES.KEPT_TASK);
                        } else {
                            taskItem.classList.remove(DOM_CLASSES.SHOW_DELETE_INDICATOR);
                            if (!newState && isRecurring) {
                                taskItem.classList.add(DOM_CLASSES.KEPT_TASK);
                            } else {
                                taskItem.classList.remove(DOM_CLASSES.KEPT_TASK);
                            }
                        }
                    }
                }
            }

            let message;
            if (newState) {
                message = getLabel('notify.taskRemovedOnReset');
            } else {
                message = currentMode === 'todo'
                    ? `📌 ${getLabel('notify.taskKeptOnComplete')}`
                    : getLabel('notify.taskRemainOnReset');
            }
            this.deps.showNotification?.(message, "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
        };
        safeAdd(button, "click", button._deleteWhenCompleteClickHandler);
    }

    /**
     * Handle disabling recurring for a task
     * @param {string} assignedTaskId - Task ID
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {HTMLElement} button - Delete-when-complete button
     * @returns {Promise<void>}
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

                // A task leaving recurring reverts to its per-mode setting. Shared
                // repair + re-derive (utils/cycleMode.js) — the local copy only
                // rebuilt a MISSING settings map, so a present-but-corrupt one
                // could assign undefined to deleteWhenComplete.
                syncTaskDeleteWhenComplete(task, getDeleteSettingsMode(cycle), DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS);
            }
        }, true);

        const state = this.deps.AppState.get();
        const cid = state.appState.activeCycleId;
        const cycle = state.data.cycles[cid];
        const task = cycle?.tasks?.find(t => t.id === assignedTaskId);
        const isToDoMode = cycle?.deleteCheckedTasks === true;
        const currentMode = isToDoMode ? 'todo' : 'cycle';

        taskItem.classList.remove(DOM_CLASSES.RECURRING);

        const recurringBtn = taskItem.querySelector(DOM_SELECTORS.RECURRING_BTN);
        if (recurringBtn) {
            recurringBtn.classList.remove(DOM_CLASSES.ACTIVE);
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

        this.deps.showNotification?.(getLabel('notify.recurringDisabled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }
}

// ============================================================================
// MODULE INSTANCE MANAGEMENT
// ============================================================================

let taskButtonsInstance = null;

/**
 * Initialize the TaskButtons singleton.
 * @param {Object} [dependencies={}] - Dependencies to inject
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

