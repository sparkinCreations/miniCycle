/**
 * miniCycle Task Events Module
 *
 * Handles all task event interactions including clicks, hover, focus, and buttons.
 * Uses event delegation pattern to prevent memory leaks from listener accumulation.
 *
 * Features:
 * - Event delegation for task clicks (single listener for all tasks)
 * - Hover/focus interactions for task options
 * - Button click handling (edit, delete, priority, due date)
 * - Three-dots menu toggle support
 * - Keyboard navigation for accessibility
 *
 * @module task/taskEvents
 * @version 1.0.0
 * @see {@link module:task/taskDOM} - Parent DOM manager
 * @see {@link module:task/taskCRUD} - Task operations
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { ICONS } from '../utils/icons.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================
// NOTE: No appContext fallback - all dependencies must come through DI
// This avoids versioned/unversioned module instance mismatch issues

const di = createDIModule('TaskEvents', {
    AppState: optional(null),
    taskCore: optional(null),
    showNotification: optional(null),
    autoSave: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null),
    checkMiniCycle: optional(null),
    triggerLogoBackground: optional(null),
    triggerLogoScan: optional(null),
    showTaskOptions: optional(null),
    hideTaskOptions: optional(null),
    TaskOptionsVisibilityController: optional(null),
    setupDueDateButtonInteraction: optional(null),
    attachKeyboardTaskOptionToggle: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null, taskCore: Object|null, showNotification: Function|null, autoSave: Function|null, enableUndoSystemOnFirstInteraction: Function|null, checkMiniCycle: Function|null, triggerLogoBackground: Function|null, showTaskOptions: Function|null, hideTaskOptions: Function|null, TaskOptionsVisibilityController: Object|null, setupDueDateButtonInteraction: Function|null, attachKeyboardTaskOptionToggle: Function|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskEvents (call before init)
 * @param {Object} dependencies - { AppState, taskCore, showNotification, etc. }
 */
export function setTaskEventsDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎮 TaskEvents dependencies set:', Object.keys(dependencies));
}

export class TaskEvents {
    constructor(dependencies = {}) {
        // Store constructor-only deps (these don't change after construction)
        this._constructorDeps = {
            // DOM helpers with defaults
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: dependencies.safeAddEventListener,
            // Core modules (injected from TaskDOMManager)
            taskCore: dependencies.taskCore,
            // Task options visibility (for three-dots menu)
            TaskOptionsVisibilityController: dependencies.TaskOptionsVisibilityController,
            showTaskOptions: dependencies.showTaskOptions,
            hideTaskOptions: dependencies.hideTaskOptions,
            attachKeyboardTaskOptionToggle: dependencies.attachKeyboardTaskOptionToggle,
            triggerLogoBackground: dependencies.triggerLogoBackground,
            triggerLogoScan: dependencies.triggerLogoScan
        };

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = dependencies.AppMeta?.version || _deps.AppMeta?.version;

        // Track if event delegation is initialized
        this._eventDelegationInitialized = false;

        console.log('🎮 TaskEvents created');
    }

    /**
     * Getter for dependencies - always reads from current module-level _deps
     * This allows late injection via setTaskEventsDependencies() to work
     */
    get deps() {
        return {
            // Core modules (prefer constructor-injected, fallback to module-level _deps)
            AppState: _deps.AppState,
            taskCore: this._constructorDeps.taskCore || _deps.taskCore,

            // UI update functions
            showNotification: _deps.showNotification || this.fallbackNotification,
            autoSave: _deps.autoSave || this.fallbackAutoSave,

            // Task interaction functions (prefer constructor-injected for three-dots menu)
            enableUndoSystemOnFirstInteraction: _deps.enableUndoSystemOnFirstInteraction,
            checkMiniCycle: _deps.checkMiniCycle,
            triggerLogoBackground: this._constructorDeps.triggerLogoBackground || _deps.triggerLogoBackground,
            triggerLogoScan: this._constructorDeps.triggerLogoScan || _deps.triggerLogoScan,
            showTaskOptions: this._constructorDeps.showTaskOptions || _deps.showTaskOptions,
            hideTaskOptions: this._constructorDeps.hideTaskOptions || _deps.hideTaskOptions,
            TaskOptionsVisibilityController: this._constructorDeps.TaskOptionsVisibilityController || _deps.TaskOptionsVisibilityController,
            setupDueDateButtonInteraction: _deps.setupDueDateButtonInteraction,
            attachKeyboardTaskOptionToggle: this._constructorDeps.attachKeyboardTaskOptionToggle || _deps.attachKeyboardTaskOptionToggle,

            // DOM helpers (from constructor)
            ...this._constructorDeps
        };
    }

    /**
     * Create the task click handler function
     * @returns {Function} The click handler
     */
    _createTaskClickHandler() {
        return (event) => {
            // Find the closest .task element
            const taskItem = event.target.closest(".task");
            if (!taskItem) return;

            // Get task elements (✅ checkbox has no class, use type selector)
            const checkbox = taskItem.querySelector("input[type='checkbox']");
            const buttonContainer = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
            const dueDateInput = taskItem.querySelector(DOM_SELECTORS.DUE_DATE);
            const threeDotsButton = taskItem.querySelector(DOM_SELECTORS.THREE_DOTS_BTN);

            // ✅ Early return if checkbox not found (incomplete task structure)
            if (!checkbox) {
                console.warn('⚠️ Task clicked but no checkbox found - skipping');
                return;
            }

            // Ignore clicks on checkbox, buttons, three-dots button, or due date input
            const isThreeDots = event.target === threeDotsButton || event.target.closest(".three-dots-btn");
            const isCheckbox = event.target === checkbox;
            const isButton = buttonContainer?.contains(event.target);
            const isDueDate = event.target === dueDateInput;

            if (isCheckbox || isThreeDots || isButton || isDueDate) {
                if (isThreeDots) {
                    console.log('🟡 Task delegation: Ignoring three-dots click (correct behavior)');
                }
                return;
            }

            console.log('🟢 Task delegation: Processing task click (will toggle checkbox)');

            // ✅ Enable undo system on first user interaction (DI-pure)
            if (typeof this.deps.enableUndoSystemOnFirstInteraction === 'function') {
                this.deps.enableUndoSystemOnFirstInteraction();
            }

            // Toggle checkbox
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
            checkbox.setAttribute("aria-checked", checkbox.checked);

            // Trigger mini cycle check (DI-pure)
            if (typeof this.deps.checkMiniCycle === 'function') {
                this.deps.checkMiniCycle();
            }

            // Note: autoSave removed - handleTaskCompletionChange already updates AppState

            // Logo animation (DI-pure) - scan effect in to-do mode, background flash otherwise
            if (checkbox.checked) {
                const isToDoMode = this.deps.AppState?.getState?.()?.settings?.isToDoMode;
                if (isToDoMode && typeof this.deps.triggerLogoScan === 'function') {
                    this.deps.triggerLogoScan(500);
                } else if (typeof this.deps.triggerLogoBackground === 'function') {
                    this.deps.triggerLogoBackground('green', 300);
                }
            }
        };
    }

    /**
     * Initialize event delegation for task clicks
     * ✅ MEMORY LEAK FIX: Uses ONE listener for all tasks instead of one per task
     * This prevents listener accumulation when tasks are re-rendered
     */
    initEventDelegation() {
        if (this._eventDelegationInitialized) {
            console.log('⚠️ Task click event delegation already initialized');
            return;
        }

        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) {
            console.warn('⚠️ Cannot initialize task click delegation - #taskList not found');
            return;
        }

        const safeAdd = this.deps.safeAddEventListener;

        // ✅ ONE listener for main task list (current and future tasks)
        taskList._taskClickHandler = this._createTaskClickHandler();
        safeAdd(taskList, "click", taskList._taskClickHandler);

        // ✅ Also add listener to completed tasks dropdown list
        const completedTaskList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
        if (completedTaskList) {
            completedTaskList._taskClickHandler = this._createTaskClickHandler();
            safeAdd(completedTaskList, "click", completedTaskList._taskClickHandler);
            console.log('✅ Task click delegation also added to completed tasks list');
        }

        this._eventDelegationInitialized = true;
        console.log('✅ Task click event delegation initialized (memory leak fix applied)');
    }

    // Fallback functions
    fallbackNotification(msg, type) {
        console.log(`[Notification] ${msg}`);
    }

    fallbackAutoSave() {
        // Silent fallback
    }

    fallbackAddListener(el, event, handler, options) {
        if (el && typeof el.addEventListener === 'function') {
            el.removeEventListener(event, handler, options);
            el.addEventListener(event, handler, options);
        }
    }

    /**
     * Handle task button clicks (edit, delete, priority)
     * @param {Event} event - Click event
     */
    handleTaskButtonClick(event) {
        event.stopPropagation();
        const button = event.currentTarget;
        const taskItem = button.closest(".task");
        if (!taskItem) return;

        const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
        // pointer-events handled by CSS .task-options-visible class

        let shouldSave = false;

        // ✅ DISABLED: Old arrow handling logic - now using event delegation
        if (button.classList.contains("move-up") || button.classList.contains("move-down")) {
            console.log('⚠️ Arrow click handled by legacy handler - should use event delegation instead');
            return;
        }

        // DI-pure: use injected taskCore
        if (button.classList.contains("edit-btn")) {
            if (this.deps.taskCore) {
                this.deps.taskCore.editTask(taskItem);
            } else {
                console.warn('⚠️ TaskCore not injected, edit operation skipped');
                _deps.showNotification?.(getLabel('notify.editUnavailable'), 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("delete-btn")) {
            if (this.deps.taskCore) {
                this.deps.taskCore.deleteTask(taskItem);
            } else {
                console.warn('⚠️ TaskCore not injected, delete operation skipped');
                _deps.showNotification?.(getLabel('notify.deleteUnavailable'), 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("priority-btn")) {
            if (this.deps.taskCore) {
                this.deps.taskCore.toggleTaskPriority(taskItem);
            } else {
                console.warn('⚠️ TaskCore not injected, priority toggle skipped');
                _deps.showNotification?.(getLabel('notify.priorityUnavailable'), 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("set-due-date")) {
            // Toggle due date input visibility
            const dueDateInput = taskItem.querySelector(DOM_SELECTORS.DUE_DATE);
            if (dueDateInput) {
                const isHidden = dueDateInput.classList.contains("hidden");
                dueDateInput.classList.toggle("hidden", !isHidden);
                if (isHidden) {
                    // Focus the input when showing
                    dueDateInput.focus();
                }
                console.log('📅 Due date input toggled:', isHidden ? 'shown' : 'hidden');
            } else {
                console.warn('⚠️ Due date input not found for task');
            }
            shouldSave = false;
        }

        // Note: autoSave removed - each operation updates AppState directly
        console.log("✅ Task button clicked:", button.className);
    }

    /**
     * Toggle hover task options (enable/disable hover interactions)
     * @param {boolean} enableHover - Whether to enable hover
     */
    toggleHoverTaskOptions(enableHover) {
        // DI-pure: use injected showTaskOptions/hideTaskOptions
        const showTaskOptions = this.deps.showTaskOptions;
        const hideTaskOptions = this.deps.hideTaskOptions;
        const safeAdd = this.deps.safeAddEventListener;

        this.deps.querySelectorAll(DOM_SELECTORS.TASK).forEach(taskItem => {
            if (enableHover) {
                if (!taskItem.classList.contains("hover-enabled")) {
                    taskItem._hoverShowHandler = showTaskOptions;
                    taskItem._hoverHideHandler = hideTaskOptions;
                    safeAdd(taskItem, "mouseenter", taskItem._hoverShowHandler);
                    safeAdd(taskItem, "mouseleave", taskItem._hoverHideHandler);
                    taskItem.classList.add("hover-enabled");
                }
            } else {
                if (taskItem.classList.contains("hover-enabled")) {
                    taskItem.removeEventListener("mouseenter", taskItem._hoverShowHandler);
                    taskItem.removeEventListener("mouseleave", taskItem._hoverHideHandler);
                    taskItem.classList.remove("hover-enabled");
                }
            }
        });
    }

    /**
     * Reveal task buttons (three dots menu OR long-press)
     * @param {HTMLElement} taskItem - Task element
     * @param {string} caller - Caller identifier ('three-dots-button', 'long-press', or 'arrow-move')
     */
    revealTaskButtons(taskItem, caller = 'three-dots-button') {
        const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
        if (!taskOptions) {
            console.warn('⚠️ revealTaskButtons: No .task-options found');
            return;
        }

        // Check current visibility state (use CSS class, not inline style)
        const isCurrentlyVisible = taskOptions.classList.contains('task-options-visible');
        const taskId = taskItem.dataset.taskId || taskItem.dataset.id;

        console.log('🔍 revealTaskButtons called:', {
            taskId: taskId || 'unknown',
            caller,
            hasVisibleClass: taskOptions.classList.contains('task-options-visible'),
            isCurrentlyVisible,
            willToggle: isCurrentlyVisible ? 'OFF' : 'ON'
        });

        // DI-pure: use injected TaskOptionsVisibilityController
        const controller = this.deps.TaskOptionsVisibilityController;

        // 🧹 Hide all other task option menus FIRST
        let hiddenCount = 0;
        // ✅ FIX: Query .task elements directly instead of using .closest()
        // This is more reliable on mobile where .closest() can sometimes fail
        document.querySelectorAll(DOM_SELECTORS.TASK).forEach(task => {
            if (task !== taskItem) {
                // Use controller for consistency (use same caller for hide)
                controller?.hide(task, caller);
                hiddenCount++;
            }
        });

        if (hiddenCount > 0) {
            console.log(`🧹 Hidden ${hiddenCount} other task option menus`);
        }

        // Determine new active task ID
        let newActiveTaskId = null;

        // Toggle visibility using centralized controller
        if (isCurrentlyVisible && caller !== 'arrow-move') {
            // Hide if already visible (clicking same task again) - but not for arrow moves
            console.log('👆 TOGGLING OFF (same task clicked twice)');
            controller?.hide(taskItem, caller);
            newActiveTaskId = null;
        } else {
            // Show if hidden (first click or switching tasks)
            console.log('✨ TOGGLING ON (first click or switching tasks)');
            controller?.show(taskItem, caller);
            newActiveTaskId = taskId || null;
        }

        // Update activeTaskId in AppState (state-driven UI)
        const AppState = this.deps.AppState;
        if (AppState?.isReady?.()) {
            AppState.update(state => {
                if (!state.ui) state.ui = {};
                state.ui.activeTaskId = newActiveTaskId;
            }, false); // Don't persist to localStorage - this is transient UI state
        }
    }

    /**
     * Sync recurring state to DOM elements
     * @param {HTMLElement} taskEl - Task element
     * @param {Object} recurringSettings - Recurring settings
     */
    syncRecurringStateToDOM(taskEl, recurringSettings) {
        taskEl.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
        const recurringBtn = taskEl.querySelector(DOM_SELECTORS.RECURRING_BTN);
        if (recurringBtn) {
            recurringBtn.classList.add("active");
            recurringBtn.setAttribute("aria-pressed", "true");
        }

        // ✅ Add recurring icon to task label if not already present
        const taskLabel = taskEl.querySelector(DOM_SELECTORS.TASK_TEXT);
        if (taskLabel) {
            let existingIcon = taskLabel.querySelector(DOM_SELECTORS.RECURRING_INDICATOR);
            if (!existingIcon) {
                const icon = document.createElement("span");
                icon.className = "recurring-indicator";
                icon.innerHTML = `<span class="icon" aria-hidden="true">${ICONS['sync-alt']}</span>`;
                taskLabel.appendChild(icon);
                console.log('✅ Added recurring icon via syncRecurringStateToDOM');
            }
        }
    }

    /**
     * Setup all task interactions (click, hover, focus)
     * @param {Object} taskElements - Task DOM elements
     * @param {Object} taskContext - Task context data
     */
    setupTaskInteractions(taskElements, taskContext) {
        const { taskItem, buttonContainer, checkbox, dueDateInput } = taskElements;
        const { settings } = taskContext;

        // ✅ MEMORY LEAK FIX: Task click is now handled by event delegation
        // setupTaskClickInteraction() is NO LONGER CALLED to prevent listener leaks
        // Instead, call initEventDelegation() once during app initialization

        // Setup priority button state
        this.setupPriorityButtonState(buttonContainer, taskContext.highPriority);

        // Setup hover interactions based on three dots setting
        this.setupTaskHoverInteractions(taskItem, settings);

        // Setup focus interactions
        this.setupTaskFocusInteractions(taskItem);

        // Setup due date button interaction (DI-pure)
        if (typeof this.deps.setupDueDateButtonInteraction === 'function') {
            this.deps.setupDueDateButtonInteraction(buttonContainer, dueDateInput);
        }
    }

    /**
     * @deprecated This method is deprecated and no longer used.
     * Task click handling is now done via event delegation in initEventDelegation().
     * This method is kept for backward compatibility but does nothing.
     *
     * @param {HTMLElement} taskItem - Task element (unused)
     * @param {HTMLElement} checkbox - Checkbox element (unused)
     * @param {HTMLElement} buttonContainer - Button container element (unused)
     * @param {HTMLElement} dueDateInput - Due date input element (unused)
     */
    setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
        // ✅ NO-OP: This method is deprecated
        // Task click handling is now done via event delegation (initEventDelegation)
        // Kept for backward compatibility only - does nothing
        console.warn('⚠️ setupTaskClickInteraction is deprecated - use initEventDelegation() instead');
    }

    /**
     * Setup priority button state
     * @param {HTMLElement} buttonContainer - Button container element
     * @param {boolean} highPriority - Whether task is high priority
     */
    setupPriorityButtonState(buttonContainer, highPriority) {
        const priorityButton = buttonContainer.querySelector(DOM_SELECTORS.PRIORITY_BTN);
        if (highPriority && priorityButton) {
            priorityButton.classList.add("priority-active");
            priorityButton.setAttribute("aria-pressed", "true");
        }
    }

    /**
     * Setup task hover interactions
     * @param {HTMLElement} taskItem - Task element
     * @param {Object} settings - Settings object
     */
    setupTaskHoverInteractions(taskItem, settings) {
        // Skip hover interactions on touch devices - they should use long-press only
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) {
            return;
        }

        const threeDotsEnabled = settings.showThreeDots || false;
        if (!threeDotsEnabled) {
            // DI-pure: use injected showTaskOptions/hideTaskOptions with safeAdd
            if (typeof this.deps.showTaskOptions === 'function' && typeof this.deps.hideTaskOptions === 'function') {
                const safeAdd = this.deps.safeAddEventListener;
                taskItem._hoverShowHandler = this.deps.showTaskOptions;
                taskItem._hoverHideHandler = this.deps.hideTaskOptions;
                safeAdd(taskItem, "mouseenter", taskItem._hoverShowHandler);
                safeAdd(taskItem, "mouseleave", taskItem._hoverHideHandler);
            }
        }
    }

    /**
     * Setup task focus interactions
     * @param {HTMLElement} taskItem - Task element
     */
    setupTaskFocusInteractions(taskItem) {
        const addListener = this.deps.safeAddEventListener;

        // DI-pure: use injected TaskOptionsVisibilityController
        const controller = this.deps.TaskOptionsVisibilityController;

        // Only show task options on KEYBOARD focus (not touch/mouse focus)
        // This prevents task options from appearing on every tap on mobile
        addListener(taskItem, "focus", () => {
            // Check if this focus event matches :focus-visible (keyboard navigation)
            // If the element doesn't match :focus-visible, it was likely triggered by touch/mouse
            try {
                if (taskItem.matches(':focus-visible')) {
                    controller?.show(taskItem, 'focusin');
                }
            } catch (e) {
                // Fallback for browsers that don't support :focus-visible
                // In this case, don't show options on focus at all (rely on keyboard toggle)
            }
        });

        // Keyboard task option toggle (DI-pure)
        if (typeof this.deps.attachKeyboardTaskOptionToggle === 'function') {
            this.deps.attachKeyboardTaskOptionToggle(taskItem);
        }
    }
}

// ============================================
// Global Instance Management
// ============================================

let taskEvents = null;

/**
 * Initialize the global task events handler
 * @param {Object} dependencies - Required dependencies
 */
export async function initTaskEvents(dependencies = {}) {
    if (taskEvents) {
        console.warn('⚠️ TaskEvents already initialized');
        return taskEvents;
    }

    taskEvents = new TaskEvents(dependencies);

    // ✅ MEMORY LEAK FIX: Initialize event delegation for task clicks
    // This sets up ONE listener for all tasks instead of one per task
    taskEvents.initEventDelegation();

    // Phase 3 - No window.* exports (main script handles exposure via taskDOMManager.events)
    return taskEvents;
}

// ============================================
// Wrapper Functions (DI-pure, no window.* fallbacks)
// ============================================

function handleTaskButtonClick(event) {
    if (!taskEvents) {
        console.warn('⚠️ TaskEvents not initialized');
        return;
    }
    return taskEvents.handleTaskButtonClick(event);
}

function toggleHoverTaskOptions(enableHover) {
    if (!taskEvents) return;
    taskEvents.toggleHoverTaskOptions(enableHover);
}

function revealTaskButtons(taskItem, caller = 'three-dots-button') {
    if (!taskEvents) return;
    taskEvents.revealTaskButtons(taskItem, caller);
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
    if (!taskEvents) return;
    taskEvents.syncRecurringStateToDOM(taskEl, recurringSettings);
}

function setupTaskInteractions(taskElements, taskContext) {
    if (!taskEvents) return;
    taskEvents.setupTaskInteractions(taskElements, taskContext);
}

function setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
    if (!taskEvents) return;
    taskEvents.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);
}

// ============================================
// Exports
// ============================================

console.log('🎮 TaskEvents module loaded (DI-pure, no window.* exports)');

// ES6 exports
export {
    handleTaskButtonClick,
    toggleHoverTaskOptions,
    revealTaskButtons,
    syncRecurringStateToDOM,
    setupTaskInteractions,
    setupTaskClickInteraction
};
