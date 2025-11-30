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
 * ⚠️ IMPORTANT: Multiple Module Instance Handling
 * Due to ES6 module versioning (?v=1.371), the same module can be loaded
 * multiple times, creating separate instances with separate module-level variables.
 *
 * Solution: All critical state is stored BOTH locally AND globally:
 * - taskDOMManager → window.__taskDOMManager
 * - TaskValidator → window.__TaskValidator
 * - TaskUtils → window.__TaskUtils
 * - TaskRenderer → window.__TaskRenderer
 * - TaskEvents → window.__TaskEvents
 *
 * All wrapper functions check: `const utils = TaskUtils || window.__TaskUtils;`
 *
 * Based on dragDropManager.js + statsPanel.js patterns
 *
 * @module modules/task/taskDOM
 * @version 1.284
 * @requires appInit, AppState, taskCore, globalUtils, taskValidation
 */

import { appInit } from '../core/appInit.js';
import {
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS,
    DEFAULT_RECURRING_DELETE_SETTINGS
} from '../core/constants.js';

// ✅ Module classes will be loaded dynamically with versioning
// ✅ Also stored globally to handle multiple module instances (see note above)
let TaskValidator, TaskUtils, TaskRenderer, TaskEvents;

export class TaskDOMManager {
    constructor(dependencies = {}) {
        // Store dependencies first
        this.dependencies = dependencies;

        // Modules will be initialized in init() after dynamic import
        this.validator = null;
        this.renderer = null;
        this.events = null;
        this.modulesLoaded = false;

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
            GlobalUtils: dependencies.GlobalUtils || window.GlobalUtils,
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

        // ✅ MEMORY LEAK FIX: Track three dots button handlers
        // WeakMap automatically garbage collects when buttons are removed
        this._threeDotsHandlers = new WeakMap();

        // Initialization flag
        this.initialized = false;

        // Instance version for runtime checks and debugging
        this.version = '1.284';

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

            // ✅ STEP 1: Load sub-modules dynamically with versioning
            if (!this.modulesLoaded) {
                console.log('📦 Loading task sub-modules with versioning...');

                // Get version for cache busting
                const version = typeof self !== 'undefined' && self.APP_VERSION
                    ? self.APP_VERSION
                    : window.APP_VERSION || '1.371';
                console.log(`📦 Using version ${version} for sub-module imports`);

                // Load all 4 sub-modules with versioned imports
                console.log('📦 Starting Promise.all for sub-module imports...');
                const [
                    { TaskValidator: ValidatorClass },
                    { TaskUtils: UtilsClass },
                    { TaskRenderer: RendererClass },
                    { TaskEvents: EventsClass }
                ] = await Promise.all([
                    import(`./taskValidation.js?v=${version}`),
                    import(`./taskUtils.js?v=${version}`),
                    import(`./taskRenderer.js?v=${version}`),
                    import(`./taskEvents.js?v=${version}`)
                ]);
                console.log('✅ All 4 sub-modules imported successfully');

                // Store classes for module-level access (both local and global)
                TaskValidator = ValidatorClass;
                TaskUtils = UtilsClass;
                TaskRenderer = RendererClass;
                TaskEvents = EventsClass;

                // ✅ CRITICAL FIX: Store globally to handle multiple module instances
                window.__TaskValidator = TaskValidator;
                window.__TaskUtils = TaskUtils;
                window.__TaskRenderer = TaskRenderer;
                window.__TaskEvents = TaskEvents;

                console.log('✅ Module-level classes stored (local + global):', {
                    TaskValidator: !!TaskValidator,
                    TaskUtils: !!TaskUtils,
                    TaskRenderer: !!TaskRenderer,
                    TaskEvents: !!TaskEvents
                });

                // Initialize validator module
                this.validator = this.dependencies.validator || new TaskValidator({
                    sanitizeInput: this.dependencies.sanitizeInput || window.sanitizeInput,
                    showNotification: this.dependencies.showNotification || this.fallbackNotification
                });

                // ✅ CRITICAL: Also initialize the global taskValidator instance for window.validateAndSanitizeTaskInput()
                if (typeof window.initTaskValidator === 'function') {
                    window.initTaskValidator({
                        sanitizeInput: this.dependencies.sanitizeInput || window.sanitizeInput,
                        showNotification: this.dependencies.showNotification || this.fallbackNotification
                    });
                    console.log('✅ Global TaskValidator instance initialized');
                }

                // Initialize renderer module
                this.renderer = this.dependencies.renderer || new TaskRenderer({
                    AppState: this.dependencies.AppState || window.AppState,
                    updateProgressBar: this.dependencies.updateProgressBar || this.fallbackUpdate,
                    checkCompleteAllButton: this.dependencies.checkCompleteAllButton || this.fallbackUpdate,
                    updateStatsPanel: this.dependencies.updateStatsPanel || this.fallbackUpdate,
                    updateMainMenuHeader: this.dependencies.updateMainMenuHeader || this.fallbackUpdate,
                    getElementById: this.dependencies.getElementById || ((id) => document.getElementById(id))
                });

                // ✅ CRITICAL: Also initialize the global taskRenderer instance for window.renderTasks()
                if (typeof window.initTaskRenderer === 'function') {
                    window.initTaskRenderer({
                        AppState: this.dependencies.AppState || window.AppState,
                        updateProgressBar: this.dependencies.updateProgressBar || this.fallbackUpdate,
                        checkCompleteAllButton: this.dependencies.checkCompleteAllButton || this.fallbackUpdate,
                        updateStatsPanel: this.dependencies.updateStatsPanel || this.fallbackUpdate,
                        updateMainMenuHeader: this.dependencies.updateMainMenuHeader || this.fallbackUpdate,
                        getElementById: this.dependencies.getElementById || ((id) => document.getElementById(id))
                    });
                    console.log('✅ Global TaskRenderer instance initialized');
                }

                // Initialize events module
                this.events = this.dependencies.events || new TaskEvents({
                    AppState: this.dependencies.AppState || window.AppState,
                    showNotification: this.dependencies.showNotification || this.fallbackNotification,
                    autoSave: this.dependencies.autoSave || this.fallbackAutoSave,
                    getElementById: this.dependencies.getElementById || ((id) => document.getElementById(id)),
                    querySelectorAll: this.dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
                    safeAddEventListener: this.dependencies.safeAddEventListener || this.fallbackAddListener
                });

                // ✅ CRITICAL: Initialize event delegation for task clicks
                // This sets up ONE listener for all tasks (memory leak fix)
                if (this.events && typeof this.events.initEventDelegation === 'function') {
                    this.events.initEventDelegation();
                    console.log('✅ Task click event delegation initialized');
                }

                // ✅ Store globally for cross-module access
                window.taskEvents = this.events;

                this.modulesLoaded = true;
                console.log('✅ Task sub-modules loaded successfully (versioned)');
            }

            // ✅ STEP 2: Wait for core systems (AppState + data) to be ready
            console.log('⏳ TaskDOMManager waiting for core systems...');
            await appInit.waitForCore();
            console.log('✅ Core systems ready, TaskDOM ready for rendering');

            this.initialized = true;
            console.log('✅ TaskDOMManager initialized successfully');
        } catch (error) {
            console.error('❌ TaskDOMManager initialization failed:', error);
            console.error('❌ Error stack:', error.stack);
            this.deps.showNotification?.('Task display may not work properly', 'warning');

            // ✅ Rethrow error so initTaskDOMManager() knows initialization failed
            throw error;
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
    // ✅ MOVED TO: modules/task/taskValidation.js
    // Use this.validator.validateAndSanitizeTaskInput(taskText)

    // GROUP 2: UTILITIES
    // ✅ MOVED TO: modules/task/taskUtils.js
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
            recurringSettings, settings, autoResetEnabled, currentCycle, deleteWhenComplete, deleteWhenCompleteSettings
        } = taskContext;

        // Get required DOM elements
        const taskList = this.deps.getElementById("taskList");
        const taskInput = this.deps.getElementById("taskInput");

        // Validate taskList exists
        if (!taskList) {
            console.error('❌ Task list element (#taskList) not found in DOM');
            throw new Error('Task list container not found');
        }

        // Create main task element
        const taskItem = this.createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle, deleteWhenComplete, deleteWhenCompleteSettings);

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
    createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle, deleteWhenComplete = false, deleteWhenCompleteSettings = null) {
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
        }

        // ✅ CRITICAL: Always set data-recurring-settings if settings exist, even when recurring=false
        // This preserves settings when user toggles recurring OFF, so they can be restored when toggled back ON
        if (hasRecurringTemplate || hasValidRecurringSettings) {
            const settingsToUse = hasRecurringTemplate
                ? currentCycle.recurringTemplates[assignedTaskId].recurringSettings
                : recurringSettings;
            taskItem.setAttribute("data-recurring-settings", JSON.stringify(settingsToUse));
        }

        // ✅ Store deleteWhenComplete state and settings
        const isToDoMode = currentCycle?.deleteCheckedTasks === true;
        const currentMode = isToDoMode ? 'todo' : 'cycle';

        // Validate and initialize settings if missing
        const validSettings = deleteWhenCompleteSettings &&
            typeof deleteWhenCompleteSettings === 'object' &&
            typeof deleteWhenCompleteSettings.cycle === 'boolean' &&
            typeof deleteWhenCompleteSettings.todo === 'boolean'
            ? deleteWhenCompleteSettings
            : { cycle: false, todo: true }; // Use defaults if invalid

        // ✅ Decide active deleteWhenComplete strictly from settings when possible
        // Priority: mode-specific setting (canonical) > legacy field > hard defaults
        let finalDeleteWhenComplete;

        // 1) Preferred: mode-specific setting (canonical source of truth)
        if (typeof validSettings[currentMode] === 'boolean') {
            finalDeleteWhenComplete = validSettings[currentMode];

        // 2) Fallback: legacy/temporary field if settings are somehow missing
        } else if (typeof deleteWhenComplete === 'boolean') {
            finalDeleteWhenComplete = deleteWhenComplete;

        // 3) Last-resort: hard defaults per mode
        } else {
            finalDeleteWhenComplete = currentMode === 'todo'
                ? true   // To-Do default = delete
                : false; // Cycle default = keep
        }

        // ✅ ALWAYS set the dataset attribute (for DOM sync)
        taskItem.dataset.deleteWhenComplete = finalDeleteWhenComplete.toString();
        taskItem.dataset.deleteWhenCompleteSettings = JSON.stringify(validSettings);

        // ✅ Apply visual indicators based on mode
        if (isToDoMode) {
            // To-Do mode: show pin ONLY if opted OUT (deleteWhenComplete=false)
            if (!finalDeleteWhenComplete && !isRecurring) {
                taskItem.classList.add("kept-task");
            }
        } else {
            // Cycle mode: show red X ONLY if opted IN (deleteWhenComplete=true)
            if (finalDeleteWhenComplete && !isRecurring) {
                taskItem.classList.add("show-delete-indicator");
            }
        }

        return taskItem;
    }

    /**
     * Handle three dots button click
     * ✅ MEMORY LEAK FIX: Named handler stored in WeakMap for proper cleanup
     * @param {HTMLElement} taskItem - The task element
     * @param {Event} event - Click event
     */
    handleThreeDotsClick(taskItem, event) {
        console.log('🔵 Three-dots button clicked:', {
            taskId: taskItem.dataset.id || 'unknown',
            eventType: event.type,
            target: event.target.className,
            timestamp: Date.now()
        });

        event.stopPropagation();

        // Use revealTaskButtons from window (will be available)
        if (typeof window.revealTaskButtons === 'function') {
            window.revealTaskButtons(taskItem);
        } else {
            console.warn('⚠️ window.revealTaskButtons not available');
        }
    }

    /**
     * Create three dots button (reveal menu)
     * ✅ MEMORY LEAK FIX: Uses named handler with safeAddEventListener
     */
    createThreeDotsButton(taskItem, settings) {
        const showThreeDots = settings?.showThreeDots || false;

        if (showThreeDots) {
            const threeDotsButton = document.createElement("button");
            threeDotsButton.classList.add("three-dots-btn");
            threeDotsButton.innerHTML = "⋮";
            threeDotsButton.setAttribute("title", "Show task options");
            threeDotsButton.setAttribute("aria-label", "Show task options");

            // ✅ MEMORY LEAK FIX: Create named handler bound to taskItem
            const handler = (event) => this.handleThreeDotsClick(taskItem, event);

            // Store handler reference for potential cleanup
            this._threeDotsHandlers.set(threeDotsButton, handler);

            // Use safeAddEventListener to prevent duplicate listeners
            const safeAdd = this.deps.safeAddEventListener || window.safeAddEventListener;
            if (safeAdd) {
                safeAdd(threeDotsButton, "click", handler);
            } else {
                threeDotsButton.addEventListener("click", handler);
            }

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

        // ✅ If three dots mode is enabled, ensure buttons start explicitly HIDDEN
        const threeDotsEnabled = settings.showThreeDots || false;
        if (threeDotsEnabled) {
            // Explicitly hide with inline styles so toggle check works correctly
            buttonContainer.style.visibility = "hidden";
            buttonContainer.style.opacity = "0";
            buttonContainer.style.pointerEvents = "none";
        }

        // ✅ NEW: Get button visibility settings for this cycle
        const visibleOptions = currentCycle.taskOptionButtons || window.DEFAULT_TASK_OPTION_BUTTONS || {};

        // ✅ NEW: Always show customize button first
        const customizeBtn = this.createCustomizeButton();
        buttonContainer.appendChild(customizeBtn);

        // ✅ UPDATED: Button configuration with visibility checks (no mode dependencies)
        // ⚠️ Move arrows visibility is controlled by global state.ui.moveArrowsVisible
        // via updateMoveArrowsVisibility(), not by taskOptionButtons
        const buttons = [
            {
                class: "move-up",
                icon: "▲",
                show: true // Always render, visibility controlled by global setting
            },
            {
                class: "move-down",
                icon: "▼",
                show: true // Always render, visibility controlled by global setting
            },
            {
                class: "priority-btn",
                icon: "<i class='fas fa-exclamation-triangle'></i>",
                show: visibleOptions.highPriority ?? true
            },
            {
                class: "edit-btn",
                icon: "<i class='fas fa-edit'></i>",
                show: visibleOptions.rename ?? true
            },
            {
                class: "delete-btn",
                icon: "<i class='fas fa-trash'></i>",
                show: visibleOptions.delete ?? true
            },
            {
                class: "recurring-btn",
                icon: "<i class='fas fa-repeat'></i>",
                show: visibleOptions.recurring ?? false
            },
            {
                class: "set-due-date",
                icon: "<i class='fas fa-calendar-alt'></i>",
                show: visibleOptions.dueDate ?? false
            },
            {
                class: "enable-task-reminders",
                icon: "<i class='fas fa-bell'></i>",
                show: visibleOptions.reminders ?? false,
                toggle: true
            },
            {
                class: "delete-when-complete-btn",
                icon: "❌",
                show: visibleOptions.deleteWhenComplete ?? false,
                toggle: true
            }
        ];

        buttons.forEach(buttonConfig => {
            const button = this.createTaskButton(buttonConfig, taskContext, buttonContainer);
            buttonContainer.appendChild(button);
        });

        return buttonContainer;
    }

    /**
     * ✅ NEW: Create the customize button (⋯)
     * Opens the task options customization modal for the current cycle
     * @returns {HTMLButtonElement} The customize button element
     */
    createCustomizeButton() {
        const button = document.createElement("button");
        button.classList.add("task-btn", "customize-btn");
        button.innerHTML = "-/+"; // Customize icon
        button.setAttribute("type", "button");
        button.setAttribute("title", "Customize task options");
        button.setAttribute("tabindex", "0");
        button.setAttribute("aria-label", "Customize which task option buttons are visible");

        // Click handler
        button.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.taskOptionsCustomizer) {
                // ✅ Always use the active cycle ID from AppState
                const state = window.AppState?.get?.();
                const activeCycleId = state?.appState?.activeCycleId;

                if (activeCycleId) {
                    window.taskOptionsCustomizer.showCustomizationModal(activeCycleId);
                } else {
                    console.warn('⚠️ No active cycle ID found');
                }
            } else {
                console.warn('⚠️ TaskOptionsCustomizer not initialized');
            }
        });

        // Keyboard handler
        button.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                button.click();
            }
        });

        return button;
    }

    /**
     * Create individual task button
     */
    createTaskButton(buttonConfig, taskContext, buttonContainer) {
        const { class: btnClass, icon, toggle = false, show } = buttonConfig;
        const { assignedTaskId, currentCycle, settings, remindersEnabled, recurring, highPriority, deleteWhenComplete } = taskContext;

        const button = document.createElement("button");
        button.classList.add("task-btn", btnClass);
        button.innerHTML = icon;
        button.setAttribute("type", "button");

        // ✅ Special handling for move arrows: always render but start hidden
        // Their visibility will be controlled by updateArrowsInDOM() based on global setting
        if (btnClass === "move-up" || btnClass === "move-down") {
            // Use .hidden class for consistent behavior (display: none !important)
            button.classList.add("hidden");
        } else if (!show) {
            button.classList.add("hidden");
        }

        // Setup accessibility attributes
        this.setupButtonAccessibility(button, btnClass, buttonContainer);

        // Setup ARIA states
        this.setupButtonAriaStates(button, btnClass, remindersEnabled, recurring, highPriority, assignedTaskId, currentCycle, deleteWhenComplete);

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

        // ARIA labels and tooltips
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
        button.setAttribute("title", label); // Add tooltip
    }

    /**
     * Setup button ARIA states (pressed, active)
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
        } else if (btnClass === "delete-when-complete-btn") {
            // ✅ Setup delete-when-complete button handler
            this.setupDeleteWhenCompleteButtonHandler(button, taskContext);
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
     * Setup delete-when-complete button handler
     * @param {HTMLButtonElement} button - The delete-when-complete button
     * @param {Object} taskContext - Task context object
     */
    setupDeleteWhenCompleteButtonHandler(button, taskContext) {
        const { assignedTaskId } = taskContext;

        button.addEventListener("click", async (e) => {
            e.stopPropagation();

            const taskItem = button.closest(".task");
            if (!taskItem) {
                console.warn('⚠️ Task item not found for delete-when-complete button');
                return;
            }

            // Check if task is recurring
            const isRecurring = taskItem.classList.contains("recurring");

            // Get current state
            const currentlyActive = button.classList.contains("delete-when-complete-active");
            const newState = !currentlyActive;

            // ✅ Prevent disabling delete-when-complete for recurring tasks
            if (isRecurring && !newState) {
                // Show confirmation modal for recurring tasks
                if (typeof this.deps.showNotification === 'function') {
                    this.deps.showNotification(
                        "⚠️ Recurring tasks must auto-delete on reset. Disabling this will prevent the task from recurring.",
                        "warning",
                        4000
                    );
                }

                // Optionally show a confirmation dialog
                const confirmed = confirm(
                    "Recurring tasks must be removed on auto-reset to spawn new instances.\n\n" +
                    "If you disable 'Delete When Complete', this task will no longer recur.\n\n" +
                    "Are you sure you want to disable recurring for this task?"
                );

                if (!confirmed) {
                    return; // User cancelled, don't change the state
                }

                // If confirmed, also disable recurring for this task
                console.log('🔁 User confirmed: Disabling recurring for task', assignedTaskId);

                // Remove recurring template and update task
                if (this.deps.AppState?.isReady?.()) {
                    await this.deps.AppState.update(state => {
                        const cid = state.appState.activeCycleId;
                        const cycle = state.data.cycles[cid];

                        // Remove recurring template
                        if (cycle?.recurringTemplates?.[assignedTaskId]) {
                            delete cycle.recurringTemplates[assignedTaskId];
                            console.log(`🗑️ Removed recurring template for task ${assignedTaskId}`);
                        }

                        // Update task to not be recurring
                        const task = cycle?.tasks?.find(t => t.id === assignedTaskId);
                        if (task) {
                            task.recurring = false;

                            // ✅ Restore mode-specific deleteWhenComplete setting
                            // Initialize settings if missing
                            if (!task.deleteWhenCompleteSettings) {
                                task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                            }

                            // Determine current mode and restore that mode's setting
                            const isToDoMode = cycle?.deleteCheckedTasks === true;
                            const currentMode = isToDoMode ? 'todo' : 'cycle';
                            task.deleteWhenComplete = task.deleteWhenCompleteSettings[currentMode];

                            console.log(`✅ Restored deleteWhenComplete from ${currentMode} mode settings:`, task.deleteWhenComplete);
                        }
                    }, true);

                    // ✅ Get the restored task data and current mode
                    const state = this.deps.AppState.get();
                    const cid = state.appState.activeCycleId;
                    const cycle = state.data.cycles[cid];
                    const task = cycle?.tasks?.find(t => t.id === assignedTaskId);
                    const isToDoMode = cycle?.deleteCheckedTasks === true;
                    const currentMode = isToDoMode ? 'todo' : 'cycle';

                    // Update DOM - remove recurring class
                    taskItem.classList.remove("recurring");

                    const recurringBtn = taskItem.querySelector(".recurring-btn");
                    if (recurringBtn) {
                        recurringBtn.classList.remove("active");
                        recurringBtn.setAttribute("aria-pressed", "false");
                    }

                    // ✅ Use centralized DOM sync function for deleteWhenComplete state
                    if (task && this.deps.GlobalUtils) {
                        this.deps.GlobalUtils.syncTaskDeleteWhenCompleteDOM(
                            taskItem,
                            task,
                            currentMode,
                            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
                        );
                    } else if (!this.deps.GlobalUtils) {
                        console.error('❌ GlobalUtils not available for recurring disable sync');
                        // Fallback: manual update
                        const restoredDeleteWhenComplete = task?.deleteWhenComplete || false;
                        taskItem.dataset.deleteWhenComplete = restoredDeleteWhenComplete.toString();
                        button.classList.toggle("active", restoredDeleteWhenComplete);
                        button.classList.toggle("delete-when-complete-active", restoredDeleteWhenComplete);
                        button.setAttribute("aria-pressed", restoredDeleteWhenComplete.toString());
                    }

                    this.deps.showNotification?.("Recurring disabled for this task", "info", 2000);
                    return; // Exit early since we've handled everything
                }
            }

            // ✅ Update state and DOM using centralized functions
            if (!this.deps.AppState?.isReady?.()) {
                console.error('❌ AppState not available for delete-when-complete toggle');
                this.deps.showNotification?.('Feature temporarily unavailable', 'error', 3000);
                return;
            }

            // Check GlobalUtils availability
            if (!this.deps.GlobalUtils) {
                console.error('❌ GlobalUtils not available - using fallback');
            }

            // Get current state info
            let state = this.deps.AppState.get();
            let activeCycleId = state.appState.activeCycleId;
            let cycle = state.data.cycles[activeCycleId];
            let isToDoMode = cycle?.deleteCheckedTasks === true;
            const currentMode = isToDoMode ? 'todo' : 'cycle';

            // Update task data in AppState
            await this.deps.AppState.update(state => {
                const cycle = state.data.cycles[activeCycleId];
                const task = cycle?.tasks?.find(t => t.id === assignedTaskId);

                if (task) {
                    // Validate and initialize settings if missing
                    const isValid = this.deps.GlobalUtils?.validateDeleteSettings(task.deleteWhenCompleteSettings);
                    if (!isValid) {
                        task.deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
                        console.warn('⚠️ Initialized missing deleteWhenCompleteSettings for task', assignedTaskId);
                    }

                    // Update active value AND mode-specific setting
                    task.deleteWhenComplete = newState;
                    task.deleteWhenCompleteSettings[currentMode] = newState;

                    console.log(`✅ Set deleteWhenComplete for task ${assignedTaskId} (${currentMode} mode): ${newState}`);
                }
            }, true);

            // Refresh state after update
            state = this.deps.AppState.get();
            const task = state.data.cycles[activeCycleId]?.tasks?.find(t => t.id === assignedTaskId);

            if (task) {
                // ✅ Use centralized DOM sync function if available
                if (this.deps.GlobalUtils) {
                    this.deps.GlobalUtils.syncTaskDeleteWhenCompleteDOM(
                        taskItem,
                        task,
                        currentMode,
                        { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
                    );
                } else {
                    // Fallback: manual DOM update
                    console.warn('⚠️ Using fallback DOM update - GlobalUtils not available');
                    taskItem.dataset.deleteWhenComplete = newState.toString();
                    taskItem.dataset.deleteWhenCompleteSettings = JSON.stringify(task.deleteWhenCompleteSettings);

                    // Update button state
                    button.classList.toggle("active", newState);
                    button.classList.toggle("delete-when-complete-active", newState);
                    button.setAttribute("aria-pressed", newState.toString());

                    // Update visual indicators
                    if (isToDoMode) {
                        taskItem.classList.remove('show-delete-indicator');
                        taskItem.classList.toggle('kept-task', !newState);
                    } else {
                        taskItem.classList.remove('kept-task');
                        taskItem.classList.toggle('show-delete-indicator', newState);
                    }
                }
            }

            // Show notification (mode-specific messaging)
            let message;
            if (newState) {
                message = "Task will be removed on auto-reset";
            } else {
                message = isToDoMode
                    ? "📌 Task will be kept on complete (pinned)"
                    : "Task will remain in list on auto-reset";
            }
            this.deps.showNotification?.(message, "info", 2000);
        });
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
            dueDateInput.id = `due-date-${assignedTaskId}`;
            dueDateInput.name = `dueDate-${assignedTaskId}`;
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

        button.addEventListener("click", (event) => {
            // ✅ Prevent event from bubbling to checkbox
            event.stopPropagation();
            event.preventDefault();

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
    // ✅ MOVED TO: modules/task/taskEvents.js
    // Use this.events.handleTaskButtonClick(), this.events.setupTaskInteractions(), etc.

    /**
     * Finalize task creation (append to DOM, scroll, etc.)
     */
    finalizeTaskCreation(taskElements, taskContext, options) {
        const { taskItem, taskList, taskInput } = taskElements;
        const { completed } = taskContext;
        const { shouldSave, isLoading, deferAppend, targetContainer } = options;

        // ✅ FIX #6: Support batched DOM operations
        const container = targetContainer || taskList;

        // Safety check: ensure container exists and is a DOM element
        if (!container || typeof container.appendChild !== 'function') {
            console.error('❌ Invalid container for task creation:', container);
            throw new Error('Task container not found or invalid');
        }

        // Append to DOM (or deferred container like DocumentFragment)
        if (!deferAppend) {
            container.appendChild(taskItem);
        } else {
            // In deferred mode, append to container but skip UI updates
            container.appendChild(taskItem);
            return taskItem; // Return for batch processing
        }

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

        return taskItem;
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
    // ✅ MOVED TO: modules/task/taskRenderer.js
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
    // ✅ Check global instance first (handles multiple module instances)
    if (window.__taskDOMManager) {
        console.warn('⚠️ TaskDOMManager already initialized (using global instance)');
        taskDOMManager = window.__taskDOMManager;

        // ✅ Also restore module-level class references from global
        if (!TaskUtils && window.__TaskUtils) TaskUtils = window.__TaskUtils;
        if (!TaskValidator && window.__TaskValidator) TaskValidator = window.__TaskValidator;
        if (!TaskRenderer && window.__TaskRenderer) TaskRenderer = window.__TaskRenderer;
        if (!TaskEvents && window.__TaskEvents) TaskEvents = window.__TaskEvents;

        return taskDOMManager;
    }

    if (taskDOMManager) {
        console.warn('⚠️ TaskDOMManager already initialized');
        return taskDOMManager;
    }

    taskDOMManager = new TaskDOMManager(dependencies);
    await taskDOMManager.init(); // Await async init

    // ✅ Verify initialization succeeded
    if (!taskDOMManager.initialized || !taskDOMManager.modulesLoaded) {
        const error = new Error('TaskDOMManager initialization failed - modules not loaded');
        console.error('❌', error.message);
        throw error;
    }

    // ✅ Verify sub-module classes are available (check both local and global)
    const utils = TaskUtils || window.__TaskUtils;
    const validator = TaskValidator || window.__TaskValidator;
    const renderer = TaskRenderer || window.__TaskRenderer;
    const events = TaskEvents || window.__TaskEvents;

    if (!utils || !validator || !renderer || !events) {
        const error = new Error('TaskDOMManager sub-modules not loaded properly');
        console.error('❌', error.message, {
            TaskUtils: !!utils,
            TaskValidator: !!validator,
            TaskRenderer: !!renderer,
            TaskEvents: !!events
        });
        throw error;
    }

    // ✅ CRITICAL FIX: Store globally to handle multiple module instances
    window.__taskDOMManager = taskDOMManager;
    console.log('✅ TaskDOMManager stored globally for cross-module access');

    console.log('✅ TaskDOMManager initialization verified - all sub-modules loaded');
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
    // ✅ Get manager from global if not in this module instance
    const manager = taskDOMManager || window.__taskDOMManager;

    if (!manager) {
        console.error('❌ CRITICAL: TaskDOMManager not found in module OR global!');
        console.error('❌ This means initTaskDOMManager() never ran');
        console.trace('❌ Call stack:');
        // Fallback validation
        if (typeof taskText !== 'string' || !taskText.trim()) return null;
        return taskText.trim();
    }
    // Delegate to validator module
    return manager.validator.validateAndSanitizeTaskInput(taskText);
}

// ============================================
// GROUP 2: Utility Wrappers
// ============================================
// ✅ DELEGATES TO: taskUtils.js

function buildTaskContext(taskItem, taskId) {
    const utils = TaskUtils || window.__TaskUtils;
    if (!utils) {
        console.warn('⚠️ TaskUtils not initialized yet, using window fallback');
        return window.TaskUtils?.buildTaskContext?.(taskItem, taskId, window.AppState) || {};
    }
    return utils.buildTaskContext(taskItem, taskId, window.AppState);
}

function extractTaskDataFromDOM() {
    // ✅ Prefer the TaskUtils implementation when it's ready (check both local and global)
    const utils = TaskUtils || window.__TaskUtils;
    if (typeof utils?.extractTaskDataFromDOM === 'function') {
        return utils.extractTaskDataFromDOM();
    }

    // 🔁 Fallback: local DOM extraction so autosave/directSave still works
    console.warn('⚠️ TaskUtils not initialized yet, using fallback extractTaskDataFromDOM');

    const taskListElement = document.getElementById('taskList');
    if (!taskListElement) {
        console.warn('⚠️ Task list element not found in fallback extractTaskDataFromDOM');
        return [];
    }

    const tasks = [...taskListElement.children].map(taskElement => {
        const taskTextElement = taskElement.querySelector(".task-text");
        const taskId = taskElement.dataset.taskId;

        if (!taskTextElement || !taskId) {
            console.warn("⚠️ Skipping invalid task element in fallback extractTaskDataFromDOM");
            return null;
        }

        // Recurring settings
        let recurringSettings = {};
        try {
            const recurringAttr = taskElement.getAttribute("data-recurring-settings");
            if (recurringAttr) {
                recurringSettings = JSON.parse(recurringAttr);
            }
        } catch (err) {
            console.warn("⚠️ Invalid recurring settings in fallback, using empty object");
        }

        // deleteWhenCompleteSettings – use defaults unless valid JSON is present
        let deleteWhenCompleteSettings = { ...DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS };
        const dwcAttr = taskElement.dataset.deleteWhenCompleteSettings;
        if (dwcAttr) {
            try {
                deleteWhenCompleteSettings = JSON.parse(dwcAttr);
            } catch (err) {
                console.warn("⚠️ Invalid deleteWhenCompleteSettings in fallback, using defaults");
            }
        }

        return {
            id: taskId,
            text: taskTextElement.textContent,
            completed: taskElement.querySelector("input[type='checkbox']")?.checked || false,
            dueDate: taskElement.querySelector(".due-date")?.value || null,
            highPriority: taskElement.classList.contains("high-priority"),
            remindersEnabled: taskElement
                .querySelector(".enable-task-reminders")
                ?.classList.contains("reminder-active") || false,
            recurring:
                taskElement.classList.contains("recurring") ||
                taskElement.querySelector(".recurring-btn")?.classList.contains("active") || false,
            recurringSettings,
            deleteWhenComplete: taskElement.dataset.deleteWhenComplete === "true" || false,
            deleteWhenCompleteSettings,
            schemaVersion: 2 // ✅ This path is only for legacy 2.5 saves
        };
    }).filter(Boolean);

    return tasks;
}

function loadTaskContext(taskTextTrimmed, taskId, taskOptions, isLoading = false) {
    const utils = TaskUtils || window.__TaskUtils;
    if (!utils) {
        console.warn('⚠️ TaskUtils not initialized yet, using window fallback');
        return window.TaskUtils?.loadTaskContext?.(
            taskTextTrimmed,
            taskId,
            taskOptions,
            isLoading,
            window.loadMiniCycleData,
            window.generateId
        ) || null;
    }
    return utils.loadTaskContext(
        taskTextTrimmed,
        taskId,
        taskOptions,
        isLoading,
        window.loadMiniCycleData,
        window.generateId
    );
}

function scrollToNewTask(taskList) {
    const utils = TaskUtils || window.__TaskUtils;
    if (!utils) {
        console.warn('⚠️ TaskUtils not initialized yet, using window fallback');
        return window.TaskUtils?.scrollToNewTask?.(taskList);
    }
    utils.scrollToNewTask(taskList);
}

function handleOverdueStyling(taskItem, completed) {
    const utils = TaskUtils || window.__TaskUtils;
    if (!utils) {
        console.warn('⚠️ TaskUtils not initialized yet, using window fallback');
        return window.TaskUtils?.handleOverdueStyling?.(taskItem, completed);
    }
    utils.handleOverdueStyling(taskItem, completed);
}

function setupFinalTaskInteractions(taskItem, isLoading) {
    const utils = TaskUtils || window.__TaskUtils;
    if (!utils) {
        console.warn('⚠️ TaskUtils not initialized yet, using window fallback');
        return window.TaskUtils?.setupFinalTaskInteractions?.(taskItem, isLoading);
    }
    utils.setupFinalTaskInteractions(taskItem, isLoading);
}

// ============================================
// GROUP 3: DOM Creation Wrappers
// ============================================

function createTaskDOMElements(taskContext, taskData) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return null;
    }
    return manager.createTaskDOMElements(taskContext, taskData);
}

function createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return document.createElement('li');
    }
    return manager.createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle);
}

function createThreeDotsButton(taskItem, settings) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) return null;
    return manager.createThreeDotsButton(taskItem, settings);
}

function createTaskButtonContainer(taskContext) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return document.createElement('div');
    }
    return manager.createTaskButtonContainer(taskContext);
}

function createTaskButton(buttonConfig, taskContext, buttonContainer) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) return document.createElement('button');
    return manager.createTaskButton(buttonConfig, taskContext, buttonContainer);
}

function createTaskContentElements(taskContext) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        const fallbackId = `fallback-${Date.now()}`;
        const checkbox = document.createElement('input');
        checkbox.id = `checkbox-${fallbackId}`;
        checkbox.name = `task-${fallbackId}`;
        const dueDateInput = document.createElement('input');
        dueDateInput.id = `duedate-${fallbackId}`;
        dueDateInput.name = `duedate-${fallbackId}`;
        return {
            checkbox: checkbox,
            taskLabel: document.createElement('span'),
            dueDateInput: dueDateInput
        };
    }
    return manager.createTaskContentElements(taskContext);
}

function createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) {
        const fallbackCheckbox = document.createElement('input');
        fallbackCheckbox.id = `checkbox-fallback-${Date.now()}`;
        fallbackCheckbox.name = `task-fallback-${Date.now()}`;
        return fallbackCheckbox;
    }
    return manager.createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed);
}

function createTaskLabel(taskTextTrimmed, assignedTaskId, recurring) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) return document.createElement('span');
    return manager.createTaskLabel(taskTextTrimmed, assignedTaskId, recurring);
}

// ============================================
// GROUP 4: Button Setup Wrappers
// ============================================

function setupRecurringButtonHandler(button, taskContext) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) return;
    manager.setupRecurringButtonHandler(button, taskContext);
}

// ✅ DELEGATES TO: taskEvents.js
function handleTaskButtonClick(event) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.handleTaskButtonClick(event);
}

function toggleHoverTaskOptions(enableHover) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.toggleHoverTaskOptions(enableHover);
}

function revealTaskButtons(taskItem, caller = 'three-dots-button') {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.revealTaskButtons(taskItem, caller);
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.syncRecurringStateToDOM(taskEl, recurringSettings);
}

// ============================================
// GROUP 5: Task Interaction Wrappers
// ============================================
// ✅ DELEGATES TO: taskEvents.js

function setupTaskInteractions(taskElements, taskContext) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.setupTaskInteractions(taskElements, taskContext);
}

function setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.setupTaskClickInteraction(taskItem, checkbox, buttonContainer, dueDateInput);
}

function setupTaskHoverInteractions(taskItem, settings) {
    // This method was removed from TaskEvents as it's integrated into setupTaskInteractions
    // Kept for backward compatibility
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.setupTaskHoverInteractions?.(taskItem, settings);
}

function setupTaskFocusInteractions(taskItem) {
    // This method was removed from TaskEvents as it's integrated into setupTaskInteractions
    // Kept for backward compatibility
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager?.events) return;
    manager.events.setupTaskFocusInteractions?.(taskItem);
}

function finalizeTaskCreation(taskElements, taskContext, options) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) return;
    manager.finalizeTaskCreation(taskElements, taskContext, options);
}

function updateUIAfterTaskCreation(shouldSave) {
    const manager = taskDOMManager || window.__taskDOMManager;
    if (!manager) return;
    manager.updateUIAfterTaskCreation(shouldSave);
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
// Phase 2 Step 13 - Clean exports (no window.* pollution)
// ============================================

console.log('🎨 TaskDOM module loaded (Phase 2 - no window.* exports - FINAL MIGRATION!)');
