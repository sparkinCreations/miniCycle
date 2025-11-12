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
 * @version 1.351
 */

export class TaskEvents {
    constructor(dependencies = {}) {
        // Store dependencies with fallbacks
        this.deps = {
            // Core modules
            AppState: dependencies.AppState || window.AppState,

            // UI update functions
            showNotification: dependencies.showNotification || this.fallbackNotification,
            autoSave: dependencies.autoSave || this.fallbackAutoSave,

            // DOM helpers
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddListener
        };

        // Instance version
        this.version = '1.351';

        console.log('🎮 TaskEvents created');
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
        } else if (button.classList.contains("edit-btn")) {
            if (window.taskCore) {
                window.taskCore.editTask(taskItem);
            } else {
                console.warn('⚠️ TaskCore not available, edit operation skipped');
                this.deps.showNotification?.('Edit feature temporarily unavailable', 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("delete-btn")) {
            if (window.taskCore) {
                window.taskCore.deleteTask(taskItem);
            } else {
                console.warn('⚠️ TaskCore not available, delete operation skipped');
                this.deps.showNotification?.('Delete feature temporarily unavailable', 'warning');
            }
            shouldSave = false;
        } else if (button.classList.contains("priority-btn")) {
            if (window.taskCore) {
                window.taskCore.toggleTaskPriority(taskItem);
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
        this.deps.querySelectorAll(".task").forEach(taskItem => {
            if (enableHover) {
                if (!taskItem.classList.contains("hover-enabled")) {
                    taskItem.addEventListener("mouseenter", window.showTaskOptions);
                    taskItem.addEventListener("mouseleave", window.hideTaskOptions);
                    taskItem.classList.add("hover-enabled");
                }
            } else {
                if (taskItem.classList.contains("hover-enabled")) {
                    taskItem.removeEventListener("mouseenter", window.showTaskOptions);
                    taskItem.removeEventListener("mouseleave", window.hideTaskOptions);
                    taskItem.classList.remove("hover-enabled");
                }
            }
        });
    }

    /**
     * Reveal task buttons (three dots menu)
     * @param {HTMLElement} taskItem - Task element
     */
    revealTaskButtons(taskItem) {
        const taskOptions = taskItem.querySelector(".task-options");
        if (!taskOptions) return;

        // 🧹 Hide all other task option menus
        document.querySelectorAll(".task-options").forEach(opts => {
            if (opts !== taskOptions) {
                opts.style.visibility = "hidden";
                opts.style.opacity = "0";
                opts.style.pointerEvents = "none";

                opts.querySelectorAll(".task-btn").forEach(btn => {
                    btn.style.visibility = "hidden";
                    btn.style.opacity = "0";
                    btn.style.pointerEvents = "none";
                });
            }
        });

        // ✅ Show this task's options
        taskOptions.style.visibility = "visible";
        taskOptions.style.opacity = "1";
        taskOptions.style.pointerEvents = "auto";

        // Get settings
        const toggleAutoReset = this.deps.getElementById("toggleAutoReset");
        const autoResetEnabled = toggleAutoReset?.checked;

        // ✅ Early return if AppState not ready
        if (!this.deps.AppState?.isReady?.()) {
            console.log('⏳ revealTaskButtons deferred - AppState not ready');
            return;
        }

        const state = this.deps.AppState.get();
        const activeCycleId = state?.appState?.activeCycleId;
        const cycleData = state?.data?.cycles?.[activeCycleId] || {};
        const deleteCheckedEnabled = cycleData.deleteCheckedTasks;
        const alwaysShow = state?.settings?.alwaysShowRecurring === true;
        const showRecurring = alwaysShow || (!autoResetEnabled && deleteCheckedEnabled);

        // ✅ Check arrow visibility settings
        const arrowsEnabled = state?.ui?.moveArrowsVisible || false;

        // ✅ Get task position for arrow logic
        const allTasks = document.querySelectorAll(".task");
        const taskIndex = Array.from(allTasks).indexOf(taskItem);
        const isFirstTask = taskIndex === 0;
        const isLastTask = taskIndex === allTasks.length - 1;

        taskOptions.querySelectorAll(".task-btn").forEach(btn => {
            const isReminderBtn = btn.classList.contains("enable-task-reminders");
            const isRecurringBtn = btn.classList.contains("recurring-btn");
            const isDueDateBtn = btn.classList.contains("set-due-date");
            const isUpArrow = btn.classList.contains("move-up");
            const isDownArrow = btn.classList.contains("move-down");

            let shouldShow;

            // ✅ Special handling for arrows
            if (isUpArrow || isDownArrow) {
                shouldShow = arrowsEnabled && (
                    (isUpArrow && !isFirstTask) ||
                    (isDownArrow && !isLastTask)
                );
            } else {
                // Regular button logic
                shouldShow =
                    (!isReminderBtn && !isRecurringBtn && !isDueDateBtn) ||
                    (isRecurringBtn && showRecurring) ||
                    (isDueDateBtn && !autoResetEnabled) ||
                    (isReminderBtn);
            }

            btn.style.visibility = shouldShow ? "visible" : "hidden";
            btn.style.opacity = shouldShow ? "1" : "0";
            btn.style.pointerEvents = shouldShow ? "auto" : "none";
        });
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

        // Setup task click interaction
        this.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);

        // Setup priority button state
        this.setupPriorityButtonState(buttonContainer, taskContext.highPriority);

        // Setup hover interactions based on three dots setting
        this.setupTaskHoverInteractions(taskItem, settings);

        // Setup focus interactions
        this.setupTaskFocusInteractions(taskItem);

        // Setup due date button interaction (from dueDates module)
        if (typeof window.setupDueDateButtonInteraction === 'function') {
            window.setupDueDateButtonInteraction(buttonContainer, dueDateInput);
        }
    }

    /**
     * Setup task click interaction (click to toggle completion)
     * @param {HTMLElement} taskItem - Task element
     * @param {HTMLElement} checkbox - Checkbox element
     * @param {HTMLElement} buttonContainer - Button container element
     * @param {HTMLElement} dueDateInput - Due date input element
     */
    setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
        taskItem.addEventListener("click", (event) => {
            if (event.target === checkbox || buttonContainer.contains(event.target) || event.target === dueDateInput) return;

            // ✅ Enable undo system on first user interaction
            if (typeof window.enableUndoSystemOnFirstInteraction === 'function') {
                window.enableUndoSystemOnFirstInteraction();
            }

            // ✅ RESTORED: Use the simple working approach
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
            checkbox.setAttribute("aria-checked", checkbox.checked);

            if (typeof window.checkMiniCycle === 'function') {
                window.checkMiniCycle();
            }

            this.deps.autoSave?.();

            if (typeof window.triggerLogoBackground === 'function') {
                window.triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
            }
        });
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
            if (typeof window.showTaskOptions === 'function' && typeof window.hideTaskOptions === 'function') {
                taskItem.addEventListener("mouseenter", window.showTaskOptions);
                taskItem.addEventListener("mouseleave", window.hideTaskOptions);
            }
        }
    }

    /**
     * Setup task focus interactions
     * @param {HTMLElement} taskItem - Task element
     */
    setupTaskFocusInteractions(taskItem) {
        const addListener = this.deps.safeAddEventListener || ((el, event, handler) => el.addEventListener(event, handler));

        addListener(taskItem, "focus", () => {
            const options = taskItem.querySelector(".task-options");
            if (options) {
                options.style.opacity = "1";
                options.style.visibility = "visible";
                options.style.pointerEvents = "auto";
            }
        });

        // Keyboard task option toggle
        if (typeof window.attachKeyboardTaskOptionToggle === 'function') {
            window.attachKeyboardTaskOptionToggle(taskItem);
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
    return taskEvents;
}

// ============================================
// Wrapper Functions
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

function revealTaskButtons(taskItem) {
    if (!taskEvents) return;
    taskEvents.revealTaskButtons(taskItem);
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

// ES6 exports
export {
    handleTaskButtonClick,
    toggleHoverTaskOptions,
    revealTaskButtons,
    syncRecurringStateToDOM,
    setupTaskInteractions,
    setupTaskClickInteraction
};

// Window exports (CRITICAL for ES6 module scope)
window.TaskEvents = TaskEvents;
window.initTaskEvents = initTaskEvents;
window.handleTaskButtonClick = handleTaskButtonClick;
window.toggleHoverTaskOptions = toggleHoverTaskOptions;
window.revealTaskButtons = revealTaskButtons;
window.syncRecurringStateToDOM = syncRecurringStateToDOM;
window.setupTaskInteractions = setupTaskInteractions;
window.setupTaskClickInteraction = setupTaskClickInteraction;

console.log('🎮 TaskEvents module loaded and ready');
