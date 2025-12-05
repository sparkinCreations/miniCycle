/**
 * 🎮 miniCycle Task Events
 * Handles all task event interactions (clicks, hover, focus, buttons)
 *
 * Pattern: Simple Instance 🎯
 * - Manages event binding and handling
 * - Coordinates user interactions
 * - Delegates to other modules (taskCore)
 *
 * @module modules/task/taskEvents
 * @version 1.393
 */

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for TaskEvents (call before init)
 * @param {Object} dependencies - { AppState, taskCore, showNotification, etc. }
 */
export function setTaskEventsDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🎮 TaskEvents dependencies set:', Object.keys(dependencies));
}

export class TaskEvents {
    constructor(dependencies = {}) {
        // Merge injected deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        // Store dependencies (no window.* fallbacks in constructor - use deferred lookup)
        this.deps = {
            // Core modules (deferred lookup in methods)
            AppState: mergedDeps.AppState,
            taskCore: mergedDeps.taskCore,

            // UI update functions
            showNotification: mergedDeps.showNotification || this.fallbackNotification,
            autoSave: mergedDeps.autoSave || this.fallbackAutoSave,

            // Task interaction functions (deferred lookup in methods)
            enableUndoSystemOnFirstInteraction: mergedDeps.enableUndoSystemOnFirstInteraction,
            checkMiniCycle: mergedDeps.checkMiniCycle,
            triggerLogoBackground: mergedDeps.triggerLogoBackground,
            showTaskOptions: mergedDeps.showTaskOptions,
            hideTaskOptions: mergedDeps.hideTaskOptions,
            TaskOptionsVisibilityController: mergedDeps.TaskOptionsVisibilityController,
            setupDueDateButtonInteraction: mergedDeps.setupDueDateButtonInteraction,
            attachKeyboardTaskOptionToggle: mergedDeps.attachKeyboardTaskOptionToggle,

            // DOM helpers
            getElementById: mergedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: mergedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: mergedDeps.safeAddEventListener || this.fallbackAddListener
        };

        // Instance version
        this.version = '1.393';

        // Track if event delegation is initialized
        this._eventDelegationInitialized = false;

        console.log('🎮 TaskEvents created');
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

        const taskList = this.deps.getElementById("taskList");
        if (!taskList) {
            console.warn('⚠️ Cannot initialize task click delegation - #taskList not found');
            return;
        }

        // ✅ ONE listener for ALL tasks (current and future)
        taskList.addEventListener("click", (event) => {
            // Find the closest .task element
            const taskItem = event.target.closest(".task");
            if (!taskItem) return;

            // Get task elements (✅ checkbox has no class, use type selector)
            const checkbox = taskItem.querySelector("input[type='checkbox']");
            const buttonContainer = taskItem.querySelector(".task-options");
            const dueDateInput = taskItem.querySelector(".due-date");
            const threeDotsButton = taskItem.querySelector(".three-dots-btn");

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

            // ✅ Enable undo system on first user interaction (deferred lookup)
            const enableUndoSystemOnFirstInteraction = this.deps.enableUndoSystemOnFirstInteraction || window.enableUndoSystemOnFirstInteraction;
            if (typeof enableUndoSystemOnFirstInteraction === 'function') {
                enableUndoSystemOnFirstInteraction();
            }

            // Toggle checkbox
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
            checkbox.setAttribute("aria-checked", checkbox.checked);

            // Trigger mini cycle check (deferred lookup)
            const checkMiniCycle = this.deps.checkMiniCycle || window.checkMiniCycle;
            if (typeof checkMiniCycle === 'function') {
                checkMiniCycle();
            }

            // Auto-save
            this.deps.autoSave?.();

            // Logo background animation (deferred lookup)
            const triggerLogoBackground = this.deps.triggerLogoBackground || window.triggerLogoBackground;
            if (typeof triggerLogoBackground === 'function') {
                triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
            }
        });

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

    fallbackAddListener(el, event, handler) {
        if (el && typeof el.addEventListener === 'function') {
            el.addEventListener(event, handler);
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

        const taskOptions = taskItem.querySelector(".task-options");
        if (taskOptions) taskOptions.style.pointerEvents = "auto";

        let shouldSave = false;

        // ✅ DISABLED: Old arrow handling logic - now using event delegation
        if (button.classList.contains("move-up") || button.classList.contains("move-down")) {
            console.log('⚠️ Arrow click handled by legacy handler - should use event delegation instead');
            return;
        }

        // Deferred lookup for taskCore
        const taskCore = this.deps.taskCore || window.taskCore;

        if (button.classList.contains("edit-btn")) {
            if (taskCore) {
                taskCore.editTask(taskItem);
            } else {
                console.warn('⚠️ TaskCore not available, edit operation skipped');
                this.deps.showNotification?.('Edit feature temporarily unavailable', 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("delete-btn")) {
            if (taskCore) {
                taskCore.deleteTask(taskItem);
            } else {
                console.warn('⚠️ TaskCore not available, delete operation skipped');
                this.deps.showNotification?.('Delete feature temporarily unavailable', 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("priority-btn")) {
            if (taskCore) {
                taskCore.toggleTaskPriority(taskItem);
            } else {
                console.warn('⚠️ TaskCore not available, priority toggle skipped');
                this.deps.showNotification?.('Priority toggle feature temporarily unavailable', 'warning');
            }
            shouldSave = false;
        }

        if (shouldSave) this.deps.autoSave?.();
        console.log("✅ Task button clicked:", button.className);
    }

    /**
     * Toggle hover task options (enable/disable hover interactions)
     * @param {boolean} enableHover - Whether to enable hover
     */
    toggleHoverTaskOptions(enableHover) {
        // Deferred lookup for showTaskOptions/hideTaskOptions
        const showTaskOptions = this.deps.showTaskOptions || window.showTaskOptions;
        const hideTaskOptions = this.deps.hideTaskOptions || window.hideTaskOptions;

        this.deps.querySelectorAll(".task").forEach(taskItem => {
            if (enableHover) {
                if (!taskItem.classList.contains("hover-enabled")) {
                    taskItem.addEventListener("mouseenter", showTaskOptions);
                    taskItem.addEventListener("mouseleave", hideTaskOptions);
                    taskItem.classList.add("hover-enabled");
                }
            } else {
                if (taskItem.classList.contains("hover-enabled")) {
                    taskItem.removeEventListener("mouseenter", showTaskOptions);
                    taskItem.removeEventListener("mouseleave", hideTaskOptions);
                    taskItem.classList.remove("hover-enabled");
                }
            }
        });
    }

    /**
     * Reveal task buttons (three dots menu OR long-press)
     * @param {HTMLElement} taskItem - Task element
     * @param {string} caller - Caller identifier ('three-dots-button' or 'long-press')
     */
    revealTaskButtons(taskItem, caller = 'three-dots-button') {
        const taskOptions = taskItem.querySelector(".task-options");
        if (!taskOptions) {
            console.warn('⚠️ revealTaskButtons: No .task-options found');
            return;
        }

        // Check current visibility state
        const isCurrentlyVisible = taskOptions.style.visibility === "visible";

        console.log('🔍 revealTaskButtons called:', {
            taskId: taskItem.dataset.id || 'unknown',
            caller,
            inlineVisibility: taskOptions.style.visibility || '(not set)',
            isCurrentlyVisible,
            willToggle: isCurrentlyVisible ? 'OFF' : 'ON'
        });

        // Deferred lookup for TaskOptionsVisibilityController
        const controller = this.deps.TaskOptionsVisibilityController || window.TaskOptionsVisibilityController;

        // 🧹 Hide all other task option menus FIRST
        let hiddenCount = 0;
        // ✅ FIX: Query .task elements directly instead of using .closest()
        // This is more reliable on mobile where .closest() can sometimes fail
        document.querySelectorAll(".task").forEach(task => {
            if (task !== taskItem) {
                // Use controller for consistency (use same caller for hide)
                controller?.hide(task, caller);
                hiddenCount++;
            }
        });

        if (hiddenCount > 0) {
            console.log(`🧹 Hidden ${hiddenCount} other task option menus`);
        }

        // Toggle visibility using centralized controller
        if (isCurrentlyVisible) {
            // Hide if already visible (clicking same task again)
            console.log('👆 TOGGLING OFF (same task clicked twice)');
            controller?.hide(taskItem, caller);
        } else {
            // Show if hidden (first click or switching tasks)
            console.log('✨ TOGGLING ON (first click or switching tasks)');
            controller?.show(taskItem, caller);
        }
    }

    /**
     * Sync recurring state to DOM elements
     * @param {HTMLElement} taskEl - Task element
     * @param {Object} recurringSettings - Recurring settings
     */
    syncRecurringStateToDOM(taskEl, recurringSettings) {
        taskEl.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
        const recurringBtn = taskEl.querySelector(".recurring-btn");
        if (recurringBtn) {
            recurringBtn.classList.add("active");
            recurringBtn.setAttribute("aria-pressed", "true");
        }

        // ✅ Add recurring icon to task label if not already present
        const taskLabel = taskEl.querySelector(".task-text");
        if (taskLabel) {
            let existingIcon = taskLabel.querySelector('.recurring-indicator');
            if (!existingIcon) {
                const icon = document.createElement("span");
                icon.className = "recurring-indicator";
                icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
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

        // Setup due date button interaction (from dueDates module) (deferred lookup)
        const setupDueDateButtonInteraction = this.deps.setupDueDateButtonInteraction || window.setupDueDateButtonInteraction;
        if (typeof setupDueDateButtonInteraction === 'function') {
            setupDueDateButtonInteraction(buttonContainer, dueDateInput);
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
        const priorityButton = buttonContainer.querySelector(".priority-btn");
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
        const threeDotsEnabled = settings.showThreeDots || false;
        if (!threeDotsEnabled) {
            // Deferred lookup for showTaskOptions/hideTaskOptions
            const showTaskOptions = this.deps.showTaskOptions || window.showTaskOptions;
            const hideTaskOptions = this.deps.hideTaskOptions || window.hideTaskOptions;
            if (typeof showTaskOptions === 'function' && typeof hideTaskOptions === 'function') {
                taskItem.addEventListener("mouseenter", showTaskOptions);
                taskItem.addEventListener("mouseleave", hideTaskOptions);
            }
        }
    }

    /**
     * Setup task focus interactions
     * @param {HTMLElement} taskItem - Task element
     */
    setupTaskFocusInteractions(taskItem) {
        const addListener = this.deps.safeAddEventListener || ((el, event, handler) => el.addEventListener(event, handler));

        // Deferred lookup for TaskOptionsVisibilityController
        const controller = this.deps.TaskOptionsVisibilityController || window.TaskOptionsVisibilityController;

        addListener(taskItem, "focus", () => {
            // ✅ Use centralized controller (handles mode checking automatically)
            controller?.show(taskItem, 'focusin');
        });

        // Keyboard task option toggle (handles focusin/focusout with better bubbling) (deferred lookup)
        const attachKeyboardTaskOptionToggle = this.deps.attachKeyboardTaskOptionToggle || window.attachKeyboardTaskOptionToggle;
        if (typeof attachKeyboardTaskOptionToggle === 'function') {
            attachKeyboardTaskOptionToggle(taskItem);
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
export function initTaskEvents(dependencies = {}) {
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
// Wrapper Functions
// Note: Uses window.taskEvents as fallback for cross-module instance access
// ============================================

function handleTaskButtonClick(event) {
    const events = taskEvents || window.taskEvents;
    if (!events) {
        console.warn('⚠️ TaskEvents not initialized');
        return;
    }
    return events.handleTaskButtonClick(event);
}

function toggleHoverTaskOptions(enableHover) {
    const events = taskEvents || window.taskEvents;
    if (!events) return;
    events.toggleHoverTaskOptions(enableHover);
}

function revealTaskButtons(taskItem, caller = 'three-dots-button') {
    const events = taskEvents || window.taskEvents;
    if (!events) return;
    events.revealTaskButtons(taskItem, caller);
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
    const events = taskEvents || window.taskEvents;
    if (!events) return;
    events.syncRecurringStateToDOM(taskEl, recurringSettings);
}

function setupTaskInteractions(taskElements, taskContext) {
    const events = taskEvents || window.taskEvents;
    if (!events) return;
    events.setupTaskInteractions(taskElements, taskContext);
}

function setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
    const events = taskEvents || window.taskEvents;
    if (!events) return;
    events.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);
}

// ============================================
// Exports
// ============================================

// Phase 2 Step 10 - Clean exports (no window.* pollution)
console.log('🎮 TaskEvents module loaded (Phase 2 - no window.* exports)');

// ES6 exports
export {
    handleTaskButtonClick,
    toggleHoverTaskOptions,
    revealTaskButtons,
    syncRecurringStateToDOM,
    setupTaskInteractions,
    setupTaskClickInteraction
};
