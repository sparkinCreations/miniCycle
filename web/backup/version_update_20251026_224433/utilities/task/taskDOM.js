/**
 * 🎨 miniCycle Task DOM Manager
 *
 * Manages all task DOM creation, rendering, and interaction setup.
 * Handles 30+ functions for creating task elements, buttons, and event listeners.
 *
 * Pattern: Resilient Constructor 🛡️
 * - Degrades gracefully when dependencies missing
 * - Shows user-friendly error messages
 * - Falls back to basic task display
 *
 * Based on dragDropManager.js + statsPanel.js patterns
 *
 * @module utilities/task/taskDOM
 * @version 1.335
 * @requires appInit, AppState, taskCore, globalUtils, taskValidation
 */

import { appInit } from '../appInitialization.js';
import { TaskValidator } from './taskValidation.js';
import { TaskUtils } from './taskUtils.js';
import { TaskRenderer } from './taskRenderer.js';
import { TaskEvents } from './taskEvents.js';

export class TaskDOMManager {
    constructor(dependencies = {}) {
        // Initialize validator module
        this.validator = dependencies.validator || new TaskValidator({
            sanitizeInput: dependencies.sanitizeInput || window.sanitizeInput,
            showNotification: dependencies.showNotification || this.fallbackNotification
        });

        // Initialize renderer module
        this.renderer = dependencies.renderer || new TaskRenderer({
            AppState: dependencies.AppState || window.AppState,
            updateProgressBar: dependencies.updateProgressBar || this.fallbackUpdate,
            checkCompleteAllButton: dependencies.checkCompleteAllButton || this.fallbackUpdate,
            updateStatsPanel: dependencies.updateStatsPanel || this.fallbackUpdate,
            updateMainMenuHeader: dependencies.updateMainMenuHeader || this.fallbackUpdate,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id))
        });

        // Initialize events module
        this.events = dependencies.events || new TaskEvents({
            AppState: dependencies.AppState || window.AppState,
            showNotification: dependencies.showNotification || this.fallbackNotification,
            autoSave: dependencies.autoSave || this.fallbackAutoSave,
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddListener
        });

        // Store dependencies with intelligent fallbacks
        this.deps = {
            // Core data access (critical - will verify in methods)
            AppState: dependencies.AppState || window.AppState,
            loadMiniCycleData: dependencies.loadMiniCycleData || this.fallbackLoadData,
            saveTaskToSchema25: dependencies.saveTaskToSchema25 || this.fallbackSave,

            // Task operations (from taskCore)
            taskCore: dependencies.taskCore || {},

            // Optional UI updates (safe with ?.() chaining)
            showNotification: dependencies.showNotification || this.fallbackNotification,
            updateProgressBar: dependencies.updateProgressBar || this.fallbackUpdate,
            updateStatsPanel: dependencies.updateStatsPanel || this.fallbackUpdate,
            checkCompleteAllButton: dependencies.checkCompleteAllButton || this.fallbackUpdate,
            updateMainMenuHeader: dependencies.updateMainMenuHeader || this.fallbackUpdate,

            // Mode management (optional)
            getCurrentMode: dependencies.getCurrentMode || this.fallbackGetMode,

            // Feature modules (all optional)
            dueDates: dependencies.dueDates || {},
            reminders: dependencies.reminders || {},
            recurringPanel: dependencies.recurringPanel || {},

            // Helper functions (optional)
            incrementCycleCount: dependencies.incrementCycleCount || this.fallbackIncrement,
            showCompletionAnimation: dependencies.showCompletionAnimation || this.fallbackAnimation,
            helpWindowManager: dependencies.helpWindowManager,
            autoSave: dependencies.autoSave || this.fallbackAutoSave,
            captureStateSnapshot: dependencies.captureStateSnapshot || this.fallbackCapture,

            // Global utils (optional)
            sanitizeInput: dependencies.sanitizeInput || window.sanitizeInput,
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddListener,
            safeGetElement: dependencies.safeGetElement || this.fallbackGetElement,
            generateId: dependencies.generateId || this.fallbackGenerateId,

            // DOM helpers (fallback to native)
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Internal state
        this.state = {
            isRendering: false,
            lastRenderTime: null,
            renderCount: 0
        };

        // Initialization flag
        this.initialized = false;

        // Instance version for runtime checks and debugging
        this.version = '1.335';

        console.log('🎨 TaskDOMManager created with dependencies');
    }

    /**
     * Initialize the task DOM system
     * Follows appInit 2-phase initialization: waits for core (AppState + data) before setup
     */
    async init() {
        try {
            if (this.initialized) {
                console.warn('⚠️ TaskDOMManager already initialized');
                return;
            }

            // ✅ Wait for core systems (AppState + data) to be ready
            console.log('⏳ TaskDOMManager waiting for core systems...');
            await appInit.waitForCore();
            console.log('✅ Core systems ready, TaskDOM ready for rendering');

            this.initialized = true;
            console.log('✅ TaskDOMManager initialized successfully');
        } catch (error) {
            console.warn('⚠️ TaskDOMManager initialization failed:', error);
            this.deps.showNotification?.('Task display may not work properly', 'warning');
        }
    }

    /**
     * Cleanup and destroy the task DOM manager
     * Removes event listeners and clears references
     */
    destroy() {
        try {
            console.log('🧹 Cleaning up TaskDOMManager...');

            // Remove hover event listeners from all tasks
            const tasks = this.deps.querySelectorAll?.('.task.hover-enabled') || [];
            tasks.forEach(taskItem => {
                if (typeof window.showTaskOptions === 'function' && typeof window.hideTaskOptions === 'function') {
                    taskItem.removeEventListener('mouseenter', window.showTaskOptions);
                    taskItem.removeEventListener('mouseleave', window.hideTaskOptions);
                    taskItem.classList.remove('hover-enabled');
                }
            });

            // Clear internal state
            this.state = {
                isRendering: false,
                lastRenderTime: null,
                renderCount: 0
            };

            // Mark as uninitialized
            this.initialized = false;

            console.log('✅ TaskDOMManager cleanup complete');
        } catch (error) {
            console.warn('⚠️ TaskDOMManager cleanup failed:', error);
        }
    }

    // ============================================
    // Fallback Methods (graceful degradation)
    // ============================================

    fallbackLoadData() {
        console.warn('⚠️ loadMiniCycleData not available - using empty data');
        return { data: { cycles: {} }, appState: { activeCycleId: null }, settings: {} };
    }

    fallbackSave() {
        console.warn('⚠️ saveTaskToSchema25 not available - changes not saved');
    }

    fallbackNotification(message, type) {
        console.log(`[TaskDOM] ${message}`);
    }

    fallbackUpdate() {
        // Silent fallback - UI updates are optional
    }

    fallbackGetMode() {
        return 'manual-cycle'; // Default to manual cycle
    }

    fallbackIncrement() {
        console.warn('⚠️ incrementCycleCount not available');
    }

    fallbackAnimation() {
        console.warn('⚠️ showCompletionAnimation not available');
    }

    fallbackAutoSave() {
        // Silent fallback - autosave is optional
    }

    fallbackCapture() {
        // Silent fallback - undo system is optional
    }

    fallbackAddListener(element, event, handler) {
        if (element && element.addEventListener) {
            element.addEventListener(event, handler);
        }
    }

    fallbackGetElement(selector) {
        return document.querySelector(selector);
    }

    fallbackGenerateId() {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Show placeholder tasks when data unavailable
     */
    showPlaceholderTasks() {
        const taskList = this.deps.getElementById('taskList');
        if (taskList) {
            taskList.innerHTML = '<li class="task placeholder" style="padding: 20px; text-align: center; color: #888;">Loading tasks...</li>';
        }
    }

    // ============================================
    // Task DOM Methods
    // ============================================

    // GROUP 1: VALIDATION
    // ✅ MOVED TO: utilities/task/taskValidation.js
    // Use this.validator.validateAndSanitizeTaskInput(taskText)

    // GROUP 2: UTILITIES
    // ✅ MOVED TO: utilities/task/taskUtils.js
    // Use TaskUtils.buildTaskContext(), TaskUtils.extractTaskDataFromDOM(), etc.

    // GROUP 3: DOM CREATION
    /**
     * Create all DOM elements for a task
     * @param {Object} taskContext - Task context object
     * @param {Object} taskData - Task data
     * @returns {Object} - Object containing all created elements
     */
    createTaskDOMElements(taskContext, taskData) {
        const {
            assignedTaskId, taskTextTrimmed, highPriority, recurring,
            recurringSettings, settings, autoResetEnabled, currentCycle
        } = taskContext;

        // Get required DOM elements
        const taskList = this.deps.getElementById("taskList");
        const taskInput = this.deps.getElementById("taskInput");

        // Create main task element
        const taskItem = this.createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle);

        // Create three dots button if needed
        const threeDotsButton = this.createThreeDotsButton(taskItem, settings);

        // Create button container and buttons
        const buttonContainer = this.createTaskButtonContainer(taskContext);

        // Create task content elements
        const { checkbox, taskLabel, dueDateInput } = this.createTaskContentElements(taskContext);

        // Create task content wrapper
        const taskContent = document.createElement("div");
        taskContent.classList.add("task-content");
        taskContent.appendChild(checkbox);
        taskContent.appendChild(taskLabel);

        // Assemble the task item
        taskItem.appendChild(buttonContainer);
        taskItem.appendChild(taskContent);
        taskItem.appendChild(dueDateInput);

        return {
            taskItem,
            taskList,
            taskInput,
            buttonContainer,
            checkbox,
            taskLabel,
            dueDateInput,
            threeDotsButton
        };
    }

    /**
     * Create main task element (li)
     */
    createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle) {
        const taskItem = document.createElement("li");
        taskItem.classList.add("task");
        taskItem.setAttribute("draggable", "true");
        taskItem.dataset.taskId = assignedTaskId;

        if (highPriority) {
            taskItem.classList.add("high-priority");
        }

        // ✅ Check if task has a recurring template (source of truth for recurring state)
        const hasRecurringTemplate = currentCycle?.recurringTemplates?.[assignedTaskId];
        const hasValidRecurringSettings = recurringSettings && Object.keys(recurringSettings).length > 0;

        // Task is recurring if: has template OR (recurring flag is true AND has settings)
        const isRecurring = hasRecurringTemplate || (recurring && hasValidRecurringSettings);

        if (isRecurring) {
            taskItem.classList.add("recurring");
            // Use settings from template if available, otherwise use task's settings
            const settingsToUse = hasRecurringTemplate
                ? currentCycle.recurringTemplates[assignedTaskId].recurringSettings
                : recurringSettings;
            taskItem.setAttribute("data-recurring-settings", JSON.stringify(settingsToUse));
        }

        return taskItem;
    }

    /**
     * Create three dots button (reveal menu)
     */
    createThreeDotsButton(taskItem, settings) {
        const showThreeDots = settings.showThreeDots || false;

        if (showThreeDots) {
            const threeDotsButton = document.createElement("button");
            threeDotsButton.classList.add("three-dots-btn");
            threeDotsButton.innerHTML = "⋮";
            threeDotsButton.addEventListener("click", (event) => {
                event.stopPropagation();
                // Use revealTaskButtons from window (will be available)
                if (typeof window.revealTaskButtons === 'function') {
                    window.revealTaskButtons(taskItem);
                }
            });
            taskItem.appendChild(threeDotsButton);
            return threeDotsButton;
        }

        return null;
    }

    /**
     * Create task button container with all buttons
     */
    createTaskButtonContainer(taskContext) {
        const {
            autoResetEnabled, deleteCheckedEnabled, settings,
            remindersEnabled, remindersEnabledGlobal, assignedTaskId,
            currentCycle, recurring, highPriority
        } = taskContext;

        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("task-options");

        const showRecurring = !autoResetEnabled && deleteCheckedEnabled;

        const buttons = [
            { class: "move-up", icon: "▲", show: true },
            { class: "move-down", icon: "▼", show: true },
            { class: "recurring-btn", icon: "<i class='fas fa-repeat'></i>", show: showRecurring || (settings.alwaysShowRecurring || false) },
            { class: "set-due-date", icon: "<i class='fas fa-calendar-alt'></i>", show: !autoResetEnabled },
            { class: "enable-task-reminders", icon: "<i class='fas fa-bell'></i>", show: remindersEnabled || remindersEnabledGlobal, toggle: true },
            { class: "priority-btn", icon: "<i class='fas fa-exclamation-triangle'></i>", show: true },
            { class: "edit-btn", icon: "<i class='fas fa-edit'></i>", show: true },
            { class: "delete-btn", icon: "<i class='fas fa-trash'></i>", show: true }
        ];

        buttons.forEach(buttonConfig => {
            const button = this.createTaskButton(buttonConfig, taskContext, buttonContainer);
            buttonContainer.appendChild(button);
        });

        return buttonContainer;
    }

    /**
     * Create individual task button
     */
    createTaskButton(buttonConfig, taskContext, buttonContainer) {
        const { class: btnClass, icon, toggle = false, show } = buttonConfig;
        const { assignedTaskId, currentCycle, settings, remindersEnabled, recurring, highPriority } = taskContext;

        const button = document.createElement("button");
        button.classList.add("task-btn", btnClass);
        button.innerHTML = icon;
        button.setAttribute("type", "button");
        if (!show) button.classList.add("hidden");

        // Setup accessibility attributes
        this.setupButtonAccessibility(button, btnClass, buttonContainer);

        // Setup ARIA states
        this.setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle);

        // Setup button event handlers
        this.setupButtonEventHandlers(button, btnClass, taskContext);

        return button;
    }

    /**
     * Setup button accessibility (keyboard navigation, ARIA labels)
     */
    setupButtonAccessibility(button, btnClass, buttonContainer) {
        button.setAttribute("tabindex", "0");

        // Keyboard navigation
        button.addEventListener("keydown", (e) => {
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
        });

        // ARIA labels
        const ariaLabels = {
            "move-up": "Move task up",
            "move-down": "Move task down",
            "recurring-btn": "Toggle recurring task",
            "set-due-date": "Set due date",
            "enable-task-reminders": "Toggle reminders for this task",
            "priority-btn": "Mark task as high priority",
            "edit-btn": "Edit task",
            "delete-btn": "Delete task"
        };
        button.setAttribute("aria-label", ariaLabels[btnClass] || "Task action");
    }

    /**
     * Setup button ARIA states (pressed, active)
     */
    setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle) {
        if (btnClass === "enable-task-reminders") {
            const isActive = remindersEnabled === true;
            button.classList.toggle("reminder-active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        } else if (["recurring-btn", "priority-btn"].includes(btnClass)) {
            let isActive;

            if (btnClass === "recurring-btn") {
                // ✅ Check if task has a recurring template (source of truth)
                const hasRecurringTemplate = currentCycle?.recurringTemplates?.[assignedTaskId];
                isActive = hasRecurringTemplate || !!recurring;

                // ✅ Debug log for recurring button
                console.log('🔘 Setting up recurring button:', {
                    taskId: assignedTaskId,
                    recurring,
                    hasRecurringTemplate: !!hasRecurringTemplate,
                    isActive,
                    hasActiveClass: button.classList.contains('active')
                });
            } else {
                isActive = !!highPriority;
            }

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        }
    }

    /**
     * Setup button event handlers
     */
    setupButtonEventHandlers(button, btnClass, taskContext) {
        if (btnClass === "recurring-btn") {
            // ✅ Setup recurring button handler (from Group 4, but referenced here)
            if (typeof window.setupRecurringButtonHandler === 'function') {
                window.setupRecurringButtonHandler(button, taskContext);
            }
        } else if (btnClass === "enable-task-reminders") {
            // ✅ Use window.setupReminderButtonHandler from reminders module
            if (typeof window.setupReminderButtonHandler === 'function') {
                window.setupReminderButtonHandler(button, taskContext);
            } else {
                console.warn('⚠️ setupReminderButtonHandler not available - reminders module failed to load');
            }
        } else if (btnClass === "move-up" || btnClass === "move-down") {
            // ✅ Skip attaching old handlers to move buttons - using event delegation
            console.log(`🔄 Skipping old handler for ${btnClass} - using event delegation`);
        } else {
            // Use handleTaskButtonClick from window
            if (typeof window.handleTaskButtonClick === 'function') {
                button.addEventListener("click", window.handleTaskButtonClick);
            }
        }
    }

    /**
     * Create task content elements (checkbox, label, due date input)
     */
    createTaskContentElements(taskContext) {
        const {
            assignedTaskId, taskTextTrimmed, completed, dueDate,
            autoResetEnabled, recurring, currentCycle, activeCycle
        } = taskContext;

        // Create checkbox
        const checkbox = this.createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed);

        // Create task label
        const taskLabel = this.createTaskLabel(taskTextTrimmed, assignedTaskId, recurring);

        // Create due date input (from dueDates module)
        let dueDateInput;
        if (typeof window.createDueDateInput === 'function') {
            dueDateInput = window.createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle);
        } else {
            // Fallback: create basic input
            dueDateInput = document.createElement("input");
            dueDateInput.type = "date";
            dueDateInput.classList.add("due-date", "hidden");
        }

        return { checkbox, taskLabel, dueDateInput };
    }

    /**
     * Create task checkbox
     */
    createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("id", `checkbox-${assignedTaskId}`);
        checkbox.setAttribute("name", `task-complete-${assignedTaskId}`);
        checkbox.checked = completed;
        checkbox.setAttribute("aria-label", `Mark task "${taskTextTrimmed}" as complete`);
        checkbox.setAttribute("aria-role", "checkbox");
        checkbox.setAttribute("aria-checked", checkbox.checked);

        // Add event listener using safe helper
        const addListener = this.deps.safeAddEventListener || ((el, event, handler) => el.addEventListener(event, handler));

        addListener(checkbox, "change", () => {
            // ✅ Enable undo system on first user interaction
            if (typeof window.enableUndoSystemOnFirstInteraction === 'function') {
                window.enableUndoSystemOnFirstInteraction();
            }

            if (typeof window.handleTaskCompletionChange === 'function') {
                window.handleTaskCompletionChange(checkbox);
            }

            if (typeof window.checkMiniCycle === 'function') {
                window.checkMiniCycle();
            }

            this.deps.autoSave?.(null, true);  // ✅ Force immediate save on task completion

            if (typeof window.triggerLogoBackground === 'function') {
                window.triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
            }

            // ✅ Update undo/redo button states
            if (typeof window.updateUndoRedoButtons === 'function') {
                window.updateUndoRedoButtons();
            }

            console.log("✅ Task completion toggled — undo snapshot pushed.");
        });

        addListener(checkbox, "keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change"));
            }
        });

        return checkbox;
    }

    /**
     * Create task label with text and optional recurring icon
     */
    createTaskLabel(taskTextTrimmed, assignedTaskId, recurring) {
        const taskLabel = document.createElement("span");
        taskLabel.classList.add("task-text");
        taskLabel.textContent = taskTextTrimmed;
        taskLabel.setAttribute("tabindex", "0");
        taskLabel.setAttribute("role", "text");
        taskLabel.id = `task-desc-${assignedTaskId}`;

        // Add recurring icon if needed
        if (recurring) {
            const icon = document.createElement("span");
            icon.className = "recurring-indicator";
            icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
            taskLabel.appendChild(icon);
        }

        return taskLabel;
    }

    // GROUP 4: BUTTON SETUP
    /**
     * Setup recurring button handler with fresh state reading
     */
    setupRecurringButtonHandler(button, taskContext) {
        const { assignedTaskId, currentCycle, activeCycle } = taskContext;

        // ✅ Mark that handler is attached to prevent double-attachment
        button.dataset.handlerAttached = 'true';

        button.addEventListener("click", () => {
            // ✅ Read fresh state from AppState to avoid stale closure data
            const currentState = this.deps.AppState?.get();
            if (!currentState) {
                console.warn('⚠️ AppState not available for recurring toggle');
                return;
            }

            const activeCycleId = currentState.appState?.activeCycleId;
            const freshCycle = currentState.data?.cycles?.[activeCycleId];

            if (!freshCycle) {
                console.warn('⚠️ Active cycle not found in AppState');
                return;
            }

            const task = freshCycle.tasks.find(t => t.id === assignedTaskId);
            if (!task) {
                console.warn('⚠️ Task not found:', assignedTaskId);
                return;
            }

            const alwaysShowRecurring = currentState?.settings?.alwaysShowRecurring || false;
            const showRecurring = !taskContext.autoResetEnabled && taskContext.deleteCheckedEnabled;

            if (!(showRecurring || alwaysShowRecurring)) {
                console.log('🚫 Recurring button click ignored - not in correct mode and always-show not enabled');
                return;
            }

            // ✅ Check template existence as source of truth (not task.recurring flag)
            const hasRecurringTemplate = freshCycle?.recurringTemplates?.[assignedTaskId];
            const isCurrentlyRecurring = !!hasRecurringTemplate;
            const isNowRecurring = !isCurrentlyRecurring;

            console.log('🔄 Toggling recurring state:', {
                taskId: assignedTaskId,
                wasRecurring: isCurrentlyRecurring,
                willBeRecurring: isNowRecurring,
                hadTemplate: !!hasRecurringTemplate
            });

            task.recurring = isNowRecurring;
            button.classList.toggle("active", isNowRecurring);
            button.setAttribute("aria-pressed", isNowRecurring.toString());

            // ✅ Add or remove recurring icon from task label
            const taskItem = button.closest('.task');
            if (taskItem) {
                const taskLabel = taskItem.querySelector('.task-text');
                if (taskLabel) {
                    let existingIcon = taskLabel.querySelector('.recurring-indicator');

                    if (isNowRecurring && !existingIcon) {
                        const icon = document.createElement("span");
                        icon.className = "recurring-indicator";
                        icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
                        taskLabel.appendChild(icon);
                        console.log('✅ Added recurring icon to task:', assignedTaskId);
                    } else if (!isNowRecurring && existingIcon) {
                        existingIcon.remove();
                        console.log('✅ Removed recurring icon from task:', assignedTaskId);
                    }
                }
            }

            // ✅ Create fresh taskContext with current settings from AppState
            const freshTaskContext = {
                ...taskContext,
                settings: currentState?.settings || {}
            };

            if (isNowRecurring) {
                if (window.handleRecurringTaskActivation) {
                    window.handleRecurringTaskActivation(task, freshTaskContext, button);
                }
            } else {
                if (window.handleRecurringTaskDeactivation) {
                    window.handleRecurringTaskDeactivation(task, freshTaskContext, assignedTaskId);
                }
            }

            // ✅ Update panel visibility
            if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
                window.recurringPanel.updateRecurringPanelButtonVisibility();
            }

            if (window.recurringPanel?.updateRecurringPanel) {
                window.recurringPanel.updateRecurringPanel();
            }
        });
    }

    /**
     * Handle task button clicks (edit, delete, priority)
     */
    // GROUP 5: TASK INTERACTIONS & EVENT HANDLING
    // ✅ MOVED TO: utilities/task/taskEvents.js
    // Use this.events.handleTaskButtonClick(), this.events.setupTaskInteractions(), etc.

    /**
     * Finalize task creation (append to DOM, scroll, etc.)
     */
    finalizeTaskCreation(taskElements, taskContext, options) {
        const { taskItem, taskList, taskInput } = taskElements;
        const { completed } = taskContext;
        const { shouldSave, isLoading } = options;

        // Append to DOM
        taskList.appendChild(taskItem);

        // Clear input
        if (taskInput) taskInput.value = "";

        // Scroll to new task (delegated to TaskUtils)
        TaskUtils.scrollToNewTask(taskList);

        // Handle overdue styling (delegated to TaskUtils)
        TaskUtils.handleOverdueStyling(taskItem, completed);

        // Update UI components
        this.updateUIAfterTaskCreation(shouldSave);

        // Setup final interactions (delegated to TaskUtils)
        TaskUtils.setupFinalTaskInteractions(taskItem, isLoading);
    }

    /**
     * Update UI after task creation (progress bar, stats, etc.)
     */
    updateUIAfterTaskCreation(shouldSave) {
        this.deps.checkCompleteAllButton?.();
        this.deps.updateProgressBar?.();
        this.deps.updateStatsPanel?.();

        // ✅ Update recurring panel button visibility when tasks are added
        if (typeof window.updateRecurringPanelButtonVisibility === 'function') {
            window.updateRecurringPanelButtonVisibility();
        }

        if (shouldSave) this.deps.autoSave?.();
    }

    // GROUP 6: RENDERING
    // ✅ MOVED TO: utilities/task/taskRenderer.js
    // Use this.renderer.renderTasks(), this.renderer.refreshUIFromState(), etc.
}

// ============================================
// Global Management
// ============================================

let taskDOMManager = null;

/**
 * Initialize the global task DOM manager
 * @param {Object} dependencies - Required dependencies
 */
async function initTaskDOMManager(dependencies = {}) {
    if (taskDOMManager) {
        console.warn('⚠️ TaskDOMManager already initialized');
        return taskDOMManager;
    }

    taskDOMManager = new TaskDOMManager(dependencies);
    await taskDOMManager.init(); // Await async init
    return taskDOMManager;
}

// ============================================
// Wrapper Functions
// ============================================

// ============================================
// GROUP 1: Validation Wrappers
// ============================================

/**
 * Validate and sanitize task input
 * ✅ DELEGATES TO: taskValidation.js module
 */
function validateAndSanitizeTaskInput(taskText) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized - using basic validation');
        // Fallback validation
        if (typeof taskText !== 'string' || !taskText.trim()) return null;
        return taskText.trim();
    }
    // Delegate to validator module
    return taskDOMManager.validator.validateAndSanitizeTaskInput(taskText);
}

// ============================================
// GROUP 2: Utility Wrappers
// ============================================
// ✅ DELEGATES TO: taskUtils.js

function buildTaskContext(taskItem, taskId) {
    return TaskUtils.buildTaskContext(taskItem, taskId, window.AppState);
}

function extractTaskDataFromDOM() {
    return TaskUtils.extractTaskDataFromDOM();
}

function loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
    return TaskUtils.loadTaskContext(
        taskTextTrimmed,
        taskId,
        taskOptions,
        isLoading,
        window.loadMiniCycleData,
        window.generateId
    );
}

function scrollToNewTask(taskList) {
    TaskUtils.scrollToNewTask(taskList);
}

function handleOverdueStyling(taskItem, completed) {
    TaskUtils.handleOverdueStyling(taskItem, completed);
}

function setupFinalTaskInteractions(taskItem, isLoading) {
    TaskUtils.setupFinalTaskInteractions(taskItem, isLoading);
}

// ============================================
// GROUP 3: DOM Creation Wrappers
// ============================================

function createTaskDOMElements(taskContext, taskData) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return null;
    }
    return taskDOMManager.createTaskDOMElements(taskContext, taskData);
}

function createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return document.createElement('li');
    }
    return taskDOMManager.createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle);
}

function createThreeDotsButton(taskItem, settings) {
    if (!taskDOMManager) return null;
    return taskDOMManager.createThreeDotsButton(taskItem, settings);
}

function createTaskButtonContainer(taskContext) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return document.createElement('div');
    }
    return taskDOMManager.createTaskButtonContainer(taskContext);
}

function createTaskButton(buttonConfig, taskContext, buttonContainer) {
    if (!taskDOMManager) return document.createElement('button');
    return taskDOMManager.createTaskButton(buttonConfig, taskContext, buttonContainer);
}

function createTaskContentElements(taskContext) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return {
            checkbox: document.createElement('input'),
            taskLabel: document.createElement('span'),
            dueDateInput: document.createElement('input')
        };
    }
    return taskDOMManager.createTaskContentElements(taskContext);
}

function createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed) {
    if (!taskDOMManager) return document.createElement('input');
    return taskDOMManager.createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed);
}

function createTaskLabel(taskTextTrimmed, assignedTaskId, recurring) {
    if (!taskDOMManager) return document.createElement('span');
    return taskDOMManager.createTaskLabel(taskTextTrimmed, assignedTaskId, recurring);
}

// ============================================
// GROUP 4: Button Setup Wrappers
// ============================================

function setupRecurringButtonHandler(button, taskContext) {
    if (!taskDOMManager) return;
    taskDOMManager.setupRecurringButtonHandler(button, taskContext);
}

// ✅ DELEGATES TO: taskEvents.js
function handleTaskButtonClick(event) {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.handleTaskButtonClick(event);
}

function toggleHoverTaskOptions(enableHover) {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.toggleHoverTaskOptions(enableHover);
}

function revealTaskButtons(taskItem) {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.revealTaskButtons(taskItem);
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.syncRecurringStateToDOM(taskEl, recurringSettings);
}

// ============================================
// GROUP 5: Task Interaction Wrappers
// ============================================
// ✅ DELEGATES TO: taskEvents.js

function setupTaskInteractions(taskElements, taskContext) {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.setupTaskInteractions(taskElements, taskContext);
}

function setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);
}

function setupTaskHoverInteractions(taskItem, settings) {
    // This method was removed from TaskEvents as it's integrated into setupTaskInteractions
    // Kept for backward compatibility
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.setupTaskHoverInteractions?.(taskItem, settings);
}

function setupTaskFocusInteractions(taskItem) {
    // This method was removed from TaskEvents as it's integrated into setupTaskInteractions
    // Kept for backward compatibility
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.setupTaskFocusInteractions?.(taskItem);
}

function finalizeTaskCreation(taskElements, taskContext, options) {
    if (!taskDOMManager) return;
    taskDOMManager.finalizeTaskCreation(taskElements, taskContext, options);
}

function updateUIAfterTaskCreation(shouldSave) {
    if (!taskDOMManager) return;
    taskDOMManager.updateUIAfterTaskCreation(shouldSave);
}

// ============================================
// GROUP 6: Rendering Wrappers
// ============================================

// ✅ DELEGATES TO: taskRenderer.js
async function renderTasks(tasksArray) {
    if (!taskDOMManager?.renderer) {
        console.warn('⚠️ TaskRenderer not initialized');
        return;
    }
    return await taskDOMManager.renderer.renderTasks(tasksArray);
}

async function refreshUIFromState(providedState) {
    if (!taskDOMManager?.renderer) {
        console.warn('⚠️ TaskRenderer not initialized');
        return;
    }
    return await taskDOMManager.renderer.refreshUIFromState(providedState);
}

async function refreshTaskListUI() {
    if (!taskDOMManager?.renderer) return;
    return await taskDOMManager.renderer.refreshTaskListUI();
}

// ============================================
// Exports
// ============================================

// Export for ES6 modules
export {
    initTaskDOMManager,
    // Group 1: Validation
    validateAndSanitizeTaskInput,
    // Group 2: Utilities
    buildTaskContext,
    extractTaskDataFromDOM,
    loadTaskContext,
    scrollToNewTask,
    handleOverdueStyling,
    setupFinalTaskInteractions,
    // Group 3: DOM Creation
    createTaskDOMElements,
    createMainTaskElement,
    createThreeDotsButton,
    createTaskButtonContainer,
    createTaskButton,
    createTaskContentElements,
    createTaskCheckbox,
    createTaskLabel,
    // Group 4: Button Setup
    setupRecurringButtonHandler,
    handleTaskButtonClick,
    toggleHoverTaskOptions,
    revealTaskButtons,
    syncRecurringStateToDOM,
    // Group 5: Task Interactions
    setupTaskInteractions,
    setupTaskClickInteraction,
    setupTaskHoverInteractions,
    setupTaskFocusInteractions,
    finalizeTaskCreation,
    updateUIAfterTaskCreation,
    // Group 6: Rendering
    renderTasks,
    refreshUIFromState,
    refreshTaskListUI
};

// ============================================
// CRITICAL: Window Exports for ES6 Module Scope
// ============================================
// These exports are MANDATORY for ES6 modules to work with miniCycle's architecture.
// Without these, functions will exist in the module scope but not be accessible
// via window.*, causing "function is not defined" errors.

// Core manager
window.TaskDOMManager = TaskDOMManager;
window.initTaskDOMManager = initTaskDOMManager;

// ✅ GROUP 1: Validation exports
window.validateAndSanitizeTaskInput = validateAndSanitizeTaskInput;

// ✅ GROUP 2: Utility exports
window.buildTaskContext = buildTaskContext;
window.extractTaskDataFromDOM = extractTaskDataFromDOM;
window.loadTaskContext = loadTaskContext;
window.scrollToNewTask = scrollToNewTask;
window.handleOverdueStyling = handleOverdueStyling;
window.setupFinalTaskInteractions = setupFinalTaskInteractions;

// ✅ GROUP 3: DOM Creation exports
window.createTaskDOMElements = createTaskDOMElements;
window.createMainTaskElement = createMainTaskElement;
window.createThreeDotsButton = createThreeDotsButton;
window.createTaskButtonContainer = createTaskButtonContainer;
window.createTaskButton = createTaskButton;
window.createTaskContentElements = createTaskContentElements;
window.createTaskCheckbox = createTaskCheckbox;
window.createTaskLabel = createTaskLabel;

// ✅ GROUP 4: Button Setup exports
window.setupRecurringButtonHandler = setupRecurringButtonHandler;
window.handleTaskButtonClick = handleTaskButtonClick;
window.toggleHoverTaskOptions = toggleHoverTaskOptions;
window.revealTaskButtons = revealTaskButtons;
window.syncRecurringStateToDOM = syncRecurringStateToDOM;

// ✅ GROUP 5: Task Interaction exports
window.setupTaskInteractions = setupTaskInteractions;
window.setupTaskClickInteraction = setupTaskClickInteraction;
window.setupTaskHoverInteractions = setupTaskHoverInteractions;
window.setupTaskFocusInteractions = setupTaskFocusInteractions;
window.finalizeTaskCreation = finalizeTaskCreation;
window.updateUIAfterTaskCreation = updateUIAfterTaskCreation;

// ✅ GROUP 6: Rendering exports
window.renderTasks = renderTasks;
window.refreshUIFromState = refreshUIFromState;
window.refreshTaskListUI = refreshTaskListUI;

console.log('🎨 TaskDOM module loaded and ready');
