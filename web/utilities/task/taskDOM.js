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
 * @version 1.330
 * @requires appInit, AppState, taskCore, globalUtils
 */

import { appInit } from '../appInitialization.js';

export class TaskDOMManager {
    constructor(dependencies = {}) {
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
        this.version = '1.330';

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
    /**
     * Validate and sanitize task input text
     * @param {string} taskText - Raw task input
     * @returns {string|null} - Sanitized text or null if invalid
     */
    validateAndSanitizeTaskInput(taskText) {
        const TASK_LIMIT = 100; // Character limit for tasks

        if (typeof taskText !== "string") {
            console.warn("⚠️ taskText is not a string", taskText);
            return null;
        }

        // Use sanitizeInput from global utils (via window or dependencies)
        const sanitizeFn = this.deps.sanitizeInput || window.sanitizeInput;
        if (!sanitizeFn) {
            console.warn("⚠️ sanitizeInput function not available");
            return null;
        }

        const taskTextTrimmed = sanitizeFn(taskText.trim());
        if (!taskTextTrimmed) {
            console.warn("⚠️ Skipping empty or unsafe task.");
            return null;
        }

        if (taskTextTrimmed.length > TASK_LIMIT) {
            this.deps.showNotification?.(`Task must be ${TASK_LIMIT} characters or less.`, 'warning');
            return null;
        }

        return taskTextTrimmed;
    }

    // GROUP 2: UTILITIES
    /**
     * Build task context from DOM element
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {string} taskId - Task ID
     * @returns {Object|null} - Task context object
     */
    buildTaskContext(taskItem, taskId) {
        try {
            // ✅ Use AppState instead of loadMiniCycleData
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for buildTaskContext');
                return null;
            }

            const state = this.deps.AppState.get();
            const activeCycleId = state.appState?.activeCycleId;

            if (!activeCycleId) return null;

            const currentCycle = state.data?.cycles?.[activeCycleId];
            if (!currentCycle) return null;

            const taskText = taskItem.querySelector('.task-text')?.textContent?.trim() || '';

            return {
                taskTextTrimmed: taskText,
                assignedTaskId: taskId,
                schemaData: state, // Pass the full state for backward compatibility
                cycles: state.data.cycles,
                activeCycle: activeCycleId,
                currentCycle,
                settings: state.settings || {},
                autoResetEnabled: currentCycle.autoReset || false,
                deleteCheckedEnabled: currentCycle.deleteCheckedTasks || false
            };
        } catch (error) {
            console.warn('⚠️ Failed to build task context:', error);
            return null;
        }
    }

    /**
     * Extract task data from DOM
     * @returns {Array} - Array of task objects
     */
    extractTaskDataFromDOM() {
        const taskListElement = this.deps.getElementById('taskList');
        if (!taskListElement) {
            console.warn('⚠️ Task list element not found');
            return [];
        }

        return [...taskListElement.children].map(taskElement => {
            const taskTextElement = taskElement.querySelector(".task-text");
            const taskId = taskElement.dataset.taskId;

            if (!taskTextElement || !taskId) {
                console.warn("⚠️ Skipping invalid task element");
                return null;
            }

            // Extract recurring settings safely
            let recurringSettings = {};
            try {
                const settingsAttr = taskElement.getAttribute("data-recurring-settings");
                if (settingsAttr) {
                    recurringSettings = JSON.parse(settingsAttr);
                }
            } catch (err) {
                console.warn("⚠️ Invalid recurring settings, using empty object");
            }

            return {
                id: taskId,
                text: taskTextElement.textContent,
                completed: taskElement.querySelector("input[type='checkbox']")?.checked || false,
                dueDate: taskElement.querySelector(".due-date")?.value || null,
                highPriority: taskElement.classList.contains("high-priority"),
                remindersEnabled: taskElement.querySelector(".enable-task-reminders")?.classList.contains("reminder-active") || false,
                recurring: taskElement.querySelector(".recurring-btn")?.classList.contains("active") || false,
                recurringSettings,
                schemaVersion: 2
            };
        }).filter(Boolean);
    }

    /**
     * Load task context from schema data
     * @param {string} taskTextTrimmed - Sanitized task text
     * @param {string} taskId - Task ID (optional, will generate if not provided)
     * @param {Object} taskOptions - Additional task options
     * @param {boolean} isLoading - Whether task is being loaded (vs created)
     * @returns {Object} - Task context object
     */
    loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
        console.log('📝 Loading task context (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.warn('⚠️ Schema 2.5 data required for loadTaskContext');
            throw new Error('Schema 2.5 data not found');
        }

        const { cycles, activeCycle, settings, reminders } = schemaData;
        const currentCycle = cycles[activeCycle];

        if (!activeCycle || !currentCycle) {
            console.warn("⚠️ No active cycle found in Schema 2.5 for loadTaskContext");
            throw new Error('No active cycle found');
        }

        console.log('📊 Active cycle found:', activeCycle);

        const assignedTaskId = taskId || this.deps.generateId?.() || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        console.log('🆔 Assigned task ID:', assignedTaskId);

        return {
            taskTextTrimmed,
            assignedTaskId,
            schemaData,
            cycles,
            activeCycle,
            currentCycle,
            settings,
            reminders,
            cycleTasks: currentCycle.tasks || [],
            autoResetEnabled: currentCycle.autoReset || false,
            remindersEnabledGlobal: reminders?.enabled === true,
            deleteCheckedEnabled: currentCycle.deleteCheckedTasks || false,
            isLoading,  // ✅ Pass through isLoading flag
            ...taskOptions
        };
    }

    /**
     * Scroll to newly created task
     * @param {HTMLElement} taskList - Task list element
     */
    scrollToNewTask(taskList) {
        const taskListContainer = this.deps.querySelector(".task-list-container");
        if (taskListContainer && taskList) {
            taskListContainer.scrollTo({
                top: taskList.scrollHeight,
                behavior: "smooth"
            });
        }
    }

    /**
     * Handle overdue task styling
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {boolean} completed - Whether task is completed
     */
    handleOverdueStyling(taskItem, completed) {
        setTimeout(() => {
            if (completed) {
                taskItem.classList.remove("overdue-task");
            }
        }, 300);
    }

    /**
     * Setup final task interactions (drag/drop, arrows)
     * @param {HTMLElement} taskItem - Task DOM element
     * @param {boolean} isLoading - Whether task is being loaded
     */
    setupFinalTaskInteractions(taskItem, isLoading) {
        // Remind overdue tasks after a delay (only if not loading)
        if (!isLoading) {
            setTimeout(() => {
                if (typeof window.remindOverdueTasks === 'function') {
                    window.remindOverdueTasks();
                }
            }, 1000);
        }

        // Enable drag and drop
        if (typeof window.DragAndDrop === 'function') {
            window.DragAndDrop(taskItem);
        } else {
            console.warn('⚠️ DragAndDrop function not available');
        }

        // Update move arrows visibility
        if (typeof window.updateMoveArrowsVisibility === 'function') {
            window.updateMoveArrowsVisibility();
        }
    }

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
     * Toggle hover task options
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

    // GROUP 5: TASK INTERACTIONS
    /**
     * Setup all task interactions (click, hover, focus)
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

        // Scroll to new task
        this.scrollToNewTask(taskList);

        // Handle overdue styling
        this.handleOverdueStyling(taskItem, completed);

        // Update UI components
        this.updateUIAfterTaskCreation(shouldSave);

        // Setup final interactions
        this.setupFinalTaskInteractions(taskItem, isLoading);
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
    /**
     * Render tasks from array
     * @param {Array} tasksArray - Array of task objects to render
     */
    async renderTasks(tasksArray = []) {
        console.log('🔄 Rendering tasks (Schema 2.5 only)...');

        const taskList = this.deps.getElementById('taskList');
        if (!taskList) {
            console.warn('⚠️ Task list container not found');
            return;
        }

        taskList.innerHTML = ""; // Clear existing tasks from DOM

        if (!Array.isArray(tasksArray)) {
            console.warn('⚠️ Invalid tasks array provided to renderTasks');
            return;
        }

        console.log(`📋 Rendering ${tasksArray.length} tasks`);

        tasksArray.forEach(task => {
            if (!task || !task.id) {
                console.warn('⚠️ Skipping invalid task:', task);
                return;
            }

            // Use window.addTask (from taskCore) to render each task
            if (typeof window.addTask === 'function') {
                window.addTask(
                    task.text,
                    task.completed,
                    false,                     // shouldSave: false (don't save during render)
                    task.dueDate,
                    task.highPriority,
                    true,                      // isLoading: true (avoid overdue reminder popups)
                    task.remindersEnabled,
                    task.recurring,
                    task.id,
                    task.recurringSettings
                );
            } else {
                console.warn('⚠️ addTask function not available');
            }
        });

        // Re-run UI state updates
        this.deps.updateProgressBar?.();
        this.deps.checkCompleteAllButton?.();
        this.deps.updateStatsPanel?.();

        // Update recurring panel
        if (typeof window.updateRecurringPanelButtonVisibility === 'function') {
            window.updateRecurringPanelButtonVisibility();
        }

        // Check overdue tasks after rendering
        if (typeof window.checkOverdueTasks === 'function') {
            setTimeout(() => {
                window.checkOverdueTasks();
            }, 500);
        }

        console.log('✅ Tasks rendered successfully');
    }

    /**
     * Refresh UI from state (re-render tasks from AppState or localStorage)
     * @param {Object} providedState - Optional state object (uses AppState if not provided)
     */
    async refreshUIFromState(providedState = null) {
        const state =
            providedState ||
            (this.deps.AppState?.isReady?.() ? this.deps.AppState.get() : null);

        if (state?.data?.cycles && state?.appState?.activeCycleId) {
            const cid = state.appState.activeCycleId;
            const cycle = state.data.cycles[cid];
            if (cycle) {
                // Render directly from current in-memory state
                await this.renderTasks(cycle.tasks || []);

                // ✅ Restore UI state after rendering
                const arrowsVisible = state.ui?.moveArrowsVisible || false;
                if (typeof window.updateArrowsInDOM === 'function') {
                    window.updateArrowsInDOM(arrowsVisible);
                }

                // Update other UI bits that don't depend on reloading storage
                if (window.recurringPanel?.updateRecurringPanel) {
                    window.recurringPanel.updateRecurringPanel();
                }
                if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
                    window.recurringPanel.updateRecurringPanelButtonVisibility();
                }
                if (typeof window.updateMainMenuHeader === 'function') {
                    window.updateMainMenuHeader();
                }

                this.deps.updateProgressBar?.();
                this.deps.checkCompleteAllButton?.();
                return;
            }
        }

        // Fallback: load from localStorage
        if (typeof window.loadMiniCycle === 'function') {
            window.loadMiniCycle();

            // ✅ Also restore arrow visibility after fallback load
            setTimeout(() => {
                if (this.deps.AppState?.isReady?.()) {
                    const currentState = this.deps.AppState.get();
                    const arrowsVisible = currentState?.ui?.moveArrowsVisible || false;
                    if (typeof window.updateArrowsInDOM === 'function') {
                        window.updateArrowsInDOM(arrowsVisible);
                    }
                }
            }, 50);
        }
    }

    /**
     * Refresh task list UI (lightweight refresh for quick updates)
     */
    async refreshTaskListUI() {
        // Quick refresh - just re-render from current state
        await this.refreshUIFromState();
    }
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
 */
function validateAndSanitizeTaskInput(taskText) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized - using basic validation');
        // Fallback validation
        if (typeof taskText !== 'string' || !taskText.trim()) return null;
        return taskText.trim();
    }
    return taskDOMManager.validateAndSanitizeTaskInput(taskText);
}

// ============================================
// GROUP 2: Utility Wrappers
// ============================================

function buildTaskContext(taskItem, taskId) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return null;
    }
    return taskDOMManager.buildTaskContext(taskItem, taskId);
}

function extractTaskDataFromDOM() {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return [];
    }
    return taskDOMManager.extractTaskDataFromDOM();
}

function loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        throw new Error('TaskDOMManager not initialized');
    }
    return taskDOMManager.loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading);
}

function scrollToNewTask(taskList) {
    if (!taskDOMManager) return;
    taskDOMManager.scrollToNewTask(taskList);
}

function handleOverdueStyling(taskItem, completed) {
    if (!taskDOMManager) return;
    taskDOMManager.handleOverdueStyling(taskItem, completed);
}

function setupFinalTaskInteractions(taskItem, isLoading) {
    if (!taskDOMManager) return;
    taskDOMManager.setupFinalTaskInteractions(taskItem, isLoading);
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

function handleTaskButtonClick(event) {
    if (!taskDOMManager) return;
    taskDOMManager.handleTaskButtonClick(event);
}

function toggleHoverTaskOptions(enableHover) {
    if (!taskDOMManager) return;
    taskDOMManager.toggleHoverTaskOptions(enableHover);
}

function revealTaskButtons(taskItem) {
    if (!taskDOMManager) return;
    taskDOMManager.revealTaskButtons(taskItem);
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
    if (!taskDOMManager) return;
    taskDOMManager.syncRecurringStateToDOM(taskEl, recurringSettings);
}

// ============================================
// GROUP 5: Task Interaction Wrappers
// ============================================

function setupTaskInteractions(taskElements, taskContext) {
    if (!taskDOMManager) return;
    taskDOMManager.setupTaskInteractions(taskElements, taskContext);
}

function setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
    if (!taskDOMManager) return;
    taskDOMManager.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);
}

function setupTaskHoverInteractions(taskItem, settings) {
    if (!taskDOMManager) return;
    taskDOMManager.setupTaskHoverInteractions(taskItem, settings);
}

function setupTaskFocusInteractions(taskItem) {
    if (!taskDOMManager) return;
    taskDOMManager.setupTaskFocusInteractions(taskItem);
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

async function renderTasks(tasksArray) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return;
    }
    return await taskDOMManager.renderTasks(tasksArray);
}

async function refreshUIFromState(providedState) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return;
    }
    return await taskDOMManager.refreshUIFromState(providedState);
}

async function refreshTaskListUI() {
    if (!taskDOMManager) return;
    return await taskDOMManager.refreshTaskListUI();
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
