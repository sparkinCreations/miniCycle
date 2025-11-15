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
 * @version 1.359
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
        this.version = '1.359';

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

            // ✅ Enable undo system on first user interaction
            if (typeof window.enableUndoSystemOnFirstInteraction === 'function') {
                window.enableUndoSystemOnFirstInteraction();
            }

            // Toggle checkbox
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
            checkbox.setAttribute("aria-checked", checkbox.checked);

            // Trigger mini cycle check
            if (typeof window.checkMiniCycle === 'function') {
                window.checkMiniCycle();
            }

            // Auto-save
            this.deps.autoSave?.();

            // Logo background animation
            if (typeof window.triggerLogoBackground === 'function') {
                window.triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
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
        if (!taskOptions) {
            console.warn('⚠️ revealTaskButtons: No .task-options found');
            return;
        }

        // ✅ FIX: Check INLINE visibility only (not computed) to avoid :hover pseudo-class interference
        // Using inline style check ensures we're only checking state set by our code, not CSS rules
        const isCurrentlyVisible = taskOptions.style.visibility === "visible";
        const computedStyle = window.getComputedStyle(taskOptions);

        console.log('🔍 revealTaskButtons called:', {
            taskId: taskItem.dataset.id || 'unknown',
            inlineVisibility: taskOptions.style.visibility || '(not set)',
            computedVisibility: computedStyle.visibility,
            isCurrentlyVisible,
            willToggleOff: isCurrentlyVisible
        });

        // 🧹 Hide all other task option menus FIRST
        let hiddenCount = 0;
        document.querySelectorAll(".task-options").forEach(opts => {
            if (opts !== taskOptions) {
                opts.style.visibility = "hidden";
                opts.style.opacity = "0";
                opts.style.pointerEvents = "none";
                hiddenCount++;
            }
        });

        if (hiddenCount > 0) {
            console.log(`🧹 Hidden ${hiddenCount} other task option menus`);
        }

        // ✅ FIX: Only toggle if clicking the SAME task again
        // If clicking a different task, always show (don't toggle)
        if (isCurrentlyVisible) {
            // Hide if already visible (clicking same task again)
            console.log('👆 TOGGLING OFF (same task clicked twice)');
            taskOptions.style.visibility = "hidden";
            taskOptions.style.opacity = "0";
            taskOptions.style.pointerEvents = "none";
        } else {
            // Show if hidden (first click or switching tasks)
            // ✅ UPDATED: No longer manipulates individual button visibility
            // Button visibility is controlled by taskOptionButtons settings via .hidden class
            console.log('✨ SHOWING task options (first click or switching tasks)');
            taskOptions.style.visibility = "visible";
            taskOptions.style.opacity = "1";
            taskOptions.style.pointerEvents = "auto";
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

        // Setup due date button interaction (from dueDates module)
        if (typeof window.setupDueDateButtonInteraction === 'function') {
            window.setupDueDateButtonInteraction(buttonContainer, dueDateInput);
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
            // ✅ Only show buttons on focus if three dots mode is NOT enabled
            const AppState = this.deps.AppState;
            const threeDotsEnabled = AppState?.isReady?.() && AppState.get()?.settings?.showThreeDots;

            if (!threeDotsEnabled) {
                const options = taskItem.querySelector(".task-options");
                if (options) {
                    options.style.opacity = "1";
                    options.style.visibility = "visible";
                    options.style.pointerEvents = "auto";
                }
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

    // ✅ MEMORY LEAK FIX: Initialize event delegation for task clicks
    // This sets up ONE listener for all tasks instead of one per task
    taskEvents.initEventDelegation();

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
