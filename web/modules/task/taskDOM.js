/**
 * 🎨 miniCycle Task DOM Manager (DI-Pure)
 *
 * Manages all task DOM creation, rendering, and interaction setup.
 * Handles 30+ functions for creating task elements, buttons, and event listeners.
 *
 * Pattern: Resilient Constructor 🛡️
 * - Degrades gracefully when dependencies missing
 * - Shows user-friendly error messages
 * - Falls back to basic task display
 *
 * Dependency Pattern (DI-Pure):
 * - this._rawDeps: Raw input from constructor (used only for sub-module pre-injection)
 * - this.deps: Normalized dependency bag with fallbacks (used for all runtime access)
 * - this.version: Uses injected AppMeta.version (no window.APP_VERSION in modules)
 * - Use this.deps.* everywhere except when checking for pre-injected sub-modules
 * - NO window.* fallbacks - module-level instances only
 *
 * Module Instance:
 * - Single instance stored in module-level `taskDOMManager` variable
 * - Main script (miniCycle-scripts.js) exposes to window.__taskDOMManager for backward compat
 * - Wrapper functions use module-level instance directly (no window.* fallbacks)
 *
 * Based on dragDropManager.js + statsPanel.js patterns
 *
 * @module modules/task/taskDOM
 * @requires appInit, AppState, taskCore, globalUtils, taskValidation
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================
// NOTE: No appContext fallback - all dependencies must come through DI
// This avoids versioned/unversioned module instance mismatch issues

const di = createDIModule('TaskDOMManager', {
    appInit: optional(null),
    AppState: optional(null),
    taskCore: optional(null),
    loadMiniCycleData: optional(null),
    autoSave: optional(null),
    showNotification: optional(null),
    sanitizeInput: optional(null),
    escapeHtml: optional(null),
    generateId: optional(null),
    syncTaskDeleteWhenCompleteDOM: optional(null),
    saveTaskToSchema25: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskDOMManager (call before initTaskDOMManager)
 * @param {Object} dependencies - Late-injected dependencies
 */
export function setTaskDOMManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎨 TaskDOMManager dependencies set:', Object.keys(dependencies));
}

// ✅ Module classes will be loaded dynamically with versioning
// ✅ Also stored globally to handle multiple module instances (see note above)
let TaskValidator, TaskUtils, TaskRenderer, TaskEvents;
// ✅ Wrapper function from taskUtils.js (uses _deps for saveTaskToSchema25)
let _createOrUpdateTaskDataFn = null;
// ✅ taskToAddTaskOptions from taskUtils.js - exported for other modules to use
let _taskToAddTaskOptions = null;

export class TaskDOMManager {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Store raw dependencies only for sub-module pre-injection (validator, renderer, events)
        // Use this.deps for all runtime access (normalized with fallbacks)
        this._rawDeps = resolvedDeps;

        // Modules will be initialized in init() after dynamic import
        this.validator = null;
        this.renderer = null;
        this.events = null;
        this.modulesLoaded = false;

        // ============================================
        // REQUIRED DEPENDENCIES - fail fast if missing
        // ============================================
        const requiredDeps = ['AppState', 'sanitizeInput'];
        const missingDeps = requiredDeps.filter(dep => !resolvedDeps[dep]);

        if (missingDeps.length > 0) {
            const error = new Error(`TaskDOMManager: Missing required dependencies: ${missingDeps.join(', ')}`);
            console.error('❌', error.message);
            throw error;
        }

        // Store dependencies - NO window.* fallbacks (Phase 3 DI)
        // All dependencies must be injected via setTaskDOMManagerDependencies() or constructor
        this.deps = {
            // ============================================
            // REQUIRED - guaranteed to exist (validated above)
            // ============================================
            AppState: resolvedDeps.AppState,
            sanitizeInput: resolvedDeps.sanitizeInput,

            // ============================================
            // IMPORTANT - warn if missing but don't fail
            // ============================================
            GlobalUtils: resolvedDeps.GlobalUtils || this._warnMissing('GlobalUtils'),
            loadMiniCycleData: resolvedDeps.loadMiniCycleData || this._warnMissingWithFallback('loadMiniCycleData', this.fallbackLoadData),
            saveTaskToSchema25: resolvedDeps.saveTaskToSchema25 || this.fallbackSave,
            generateId: resolvedDeps.generateId || this._warnMissingWithFallback('generateId', this.fallbackGenerateId),

            // ============================================
            // OPTIONAL - safe to omit (use fallbacks)
            // ============================================

            // Task operations
            taskCore: resolvedDeps.taskCore || this._warnMissingOptional('taskCore'),

            // UI updates (safe with ?.() chaining)
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            updateProgressBar: resolvedDeps.updateProgressBar || this.fallbackUpdate,
            updateStatsPanel: resolvedDeps.updateStatsPanel || this.fallbackUpdate,
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || this.fallbackUpdate,
            updateMainMenuHeader: resolvedDeps.updateMainMenuHeader || this.fallbackUpdate,

            // Mode management
            getCurrentMode: resolvedDeps.getCurrentMode || this.fallbackGetMode,

            // Feature modules
            dueDates: resolvedDeps.dueDates || this._warnMissingOptional('dueDates'),
            reminders: resolvedDeps.reminders || this._warnMissingOptional('reminders'),
            recurringPanel: resolvedDeps.recurringPanel || this._warnMissingOptional('recurringPanel'),

            // Helper functions
            incrementCycleCount: resolvedDeps.incrementCycleCount || this.fallbackIncrement,
            showCompletionAnimation: resolvedDeps.showCompletionAnimation || this.fallbackAnimation,
            helpWindowManager: resolvedDeps.helpWindowManager || null,
            autoSave: resolvedDeps.autoSave || this.fallbackAutoSave,
            captureStateSnapshot: resolvedDeps.captureStateSnapshot || this.fallbackCapture,

            // Task completion handlers
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction || null,
            handleTaskCompletionChange: resolvedDeps.handleTaskCompletionChange || null,
            checkMiniCycle: resolvedDeps.checkMiniCycle || null,
            triggerLogoBackground: resolvedDeps.triggerLogoBackground || null,
            updateUndoRedoButtons: resolvedDeps.updateUndoRedoButtons || null,

            // Due dates module
            createDueDateInput: resolvedDeps.createDueDateInput || null,

            // Task options customizer
            taskOptionsCustomizer: resolvedDeps.taskOptionsCustomizer || null,

            // Recurring handlers
            handleRecurringTaskActivation: resolvedDeps.handleRecurringTaskActivation || null,
            handleRecurringTaskDeactivation: resolvedDeps.handleRecurringTaskDeactivation || null,
            updateRecurringPanelButtonVisibility: resolvedDeps.updateRecurringPanelButtonVisibility || null,

            // DOM helpers (fallback to native)
            safeAddEventListener: resolvedDeps.safeAddEventListener || this.fallbackAddListener,
            safeGetElement: resolvedDeps.safeGetElement || this.fallbackGetElement,
            getElementById: resolvedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelector: resolvedDeps.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: resolvedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel)),

            // Constants
            DEFAULT_TASK_OPTION_BUTTONS: resolvedDeps.DEFAULT_TASK_OPTION_BUTTONS || {},

            // Task option UI functions
            revealTaskButtons: resolvedDeps.revealTaskButtons || null,
            showTaskOptions: resolvedDeps.showTaskOptions || null,
            hideTaskOptions: resolvedDeps.hideTaskOptions || null,
            TaskOptionsVisibilityController: resolvedDeps.TaskOptionsVisibilityController || null,
            attachKeyboardTaskOptionToggle: resolvedDeps.attachKeyboardTaskOptionToggle || null,
            setupRecurringButtonHandler: resolvedDeps.setupRecurringButtonHandler || null,
            setupReminderButtonHandler: resolvedDeps.setupReminderButtonHandler || null,
            handleTaskButtonClick: resolvedDeps.handleTaskButtonClick || null,
            updateMoveArrowsVisibility: resolvedDeps.updateMoveArrowsVisibility || null,

            // Drag and drop / task interactions (for TaskUtils)
            enableDragAndDropOnTask: resolvedDeps.enableDragAndDropOnTask || null,
            remindOverdueTasks: resolvedDeps.remindOverdueTasks || null
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
        // Uses injected AppMeta (no window.* in modules, no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

        console.log('🎨 TaskDOMManager created with dependencies');
    }

    /**
     * Inject a dependency after construction (for late-bound dependencies)
     * @param {string} name - The dependency name
     * @param {*} value - The dependency value
     */
    injectDependency(name, value) {
        this.deps[name] = value;
        console.log(`💉 TaskDOMManager: Injected dependency '${name}'`);

        // ✅ Also inject into renderer if it exists (for deps like enableDragAndDropOnTask)
        if (this.renderer && typeof this.renderer.injectDependency === 'function') {
            this.renderer.injectDependency(name, value);
        }
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

                // Get version for cache busting - use injected version only (DI-pure)
                if (!this.version) {
                    console.warn('⚠️ TaskDOMManager: AppMeta.version not provided');
                }
                const version = this.version || 'dev-local';
                console.log(`📦 Using version ${version} for sub-module imports`);

                // Load all 4 sub-modules with versioned imports
                console.log('📦 Starting Promise.all for sub-module imports...');
                const [
                    { TaskValidator: ValidatorClass },
                    { TaskUtils: UtilsClass, setTaskUtilsDependencies, createOrUpdateTaskData: createOrUpdateTaskDataWrapper, taskToAddTaskOptions },
                    { TaskRenderer: RendererClass },
                    { TaskEvents: EventsClass }
                ] = await Promise.all([
                    import(`./taskValidation.js?v=${version}`),
                    import(`./taskUtils.js?v=${version}`),
                    import(`./taskRenderer.js?v=${version}`),
                    import(`./taskEvents.js?v=${version}`)
                ]);
                console.log('✅ All 4 sub-modules imported successfully');

                // Store classes for module-level access
                TaskValidator = ValidatorClass;
                TaskUtils = UtilsClass;
                TaskRenderer = RendererClass;
                TaskEvents = EventsClass;
                // Store wrapper function that uses _deps (for saveTaskToSchema25)
                _createOrUpdateTaskDataFn = createOrUpdateTaskDataWrapper;
                // Store taskToAddTaskOptions for export to other modules
                _taskToAddTaskOptions = taskToAddTaskOptions;

                // Wire TaskUtils dependencies for wrapper functions (DI-pure)
                // Use this.deps (instance deps from constructor) - these have the actual injected functions
                const instanceDeps = this.deps;
                setTaskUtilsDependencies({
                    get AppState() { return instanceDeps.AppState; },
                    get loadMiniCycleData() { return instanceDeps.loadMiniCycleData; },
                    get generateId() { return instanceDeps.generateId; },
                    get remindOverdueTasks() { return instanceDeps.remindOverdueTasks; },
                    get enableDragAndDropOnTask() { return instanceDeps.enableDragAndDropOnTask; },
                    get updateMoveArrowsVisibility() { return instanceDeps.updateMoveArrowsVisibility; },
                    get saveTaskToSchema25() { return instanceDeps.saveTaskToSchema25; }
                });

                console.log('✅ Module-level classes stored:', {
                    TaskValidator: !!TaskValidator,
                    TaskUtils: !!TaskUtils,
                    TaskRenderer: !!TaskRenderer,
                    TaskEvents: !!TaskEvents
                });

                // Initialize validator module - no window.* fallbacks (Phase 2)
                // window.validateAndSanitizeTaskInput uses this validator via manager
                this.validator = this._rawDeps.validator || new TaskValidator({
                    appVersion: this.version,  // Pass injected version
                    sanitizeInput: this.deps.sanitizeInput,  // Required - already validated
                    showNotification: this.deps.showNotification
                });

                // Initialize renderer module - Phase 3: pass all dependencies (no window.* fallbacks)
                // Note: enableDragAndDropOnTask may be null here - it gets injected later via
                // moduleLoader post-init injection, which propagates to renderer via injectDependency()
                this.renderer = this._rawDeps.renderer || new TaskRenderer({
                    // Core state
                    appVersion: this.version,  // Pass injected version
                    AppState: this.deps.AppState,

                    // Task management (from raw deps - passed at construction time)
                    addTask: this._rawDeps.addTask || null,
                    loadMiniCycle: this._rawDeps.loadMiniCycle || null,

                    // UI update functions (all normalized in this.deps)
                    updateProgressBar: this.deps.updateProgressBar,
                    checkCompleteAllButton: this.deps.checkCompleteAllButton,
                    updateStatsPanel: this.deps.updateStatsPanel,
                    updateMainMenuHeader: this.deps.updateMainMenuHeader,
                    updateArrowsInDOM: this._rawDeps.updateArrowsInDOM || null,
                    checkOverdueTasks: this._rawDeps.checkOverdueTasks || null,

                    // Drag-drop (may be null initially - gets injected via injectDependency later)
                    enableDragAndDropOnTask: this._rawDeps.enableDragAndDropOnTask || null,

                    // Recurring panel
                    recurringPanel: this.deps.recurringPanel,
                    updateRecurringPanelButtonVisibility: this.deps.updateRecurringPanelButtonVisibility,

                    // DOM helpers
                    getElementById: this.deps.getElementById,
                    querySelectorAll: this.deps.querySelectorAll,

                    // TaskUtils helper (injected to avoid duplicate module loading)
                    taskToAddTaskOptions: taskToAddTaskOptions
                });

                // Initialize events module - no window.* fallbacks (Phase 2)
                this.events = this._rawDeps.events || new TaskEvents({
                    appVersion: this.version,  // Pass injected version
                    AppState: this.deps.AppState,  // Required - already validated
                    showNotification: this.deps.showNotification,
                    autoSave: this.deps.autoSave,
                    getElementById: this.deps.getElementById,
                    querySelectorAll: this.deps.querySelectorAll,
                    safeAddEventListener: this.deps.safeAddEventListener,
                    taskCore: this.deps.taskCore,  // For edit, delete, priority operations
                    // Task options visibility (for three-dots menu)
                    TaskOptionsVisibilityController: this.deps.TaskOptionsVisibilityController,
                    showTaskOptions: this.deps.showTaskOptions,
                    hideTaskOptions: this.deps.hideTaskOptions,
                    attachKeyboardTaskOptionToggle: this.deps.attachKeyboardTaskOptionToggle,
                    triggerLogoBackground: this.deps.triggerLogoBackground
                });

                // ✅ CRITICAL: Initialize event delegation for task clicks
                // This sets up ONE listener for all tasks (memory leak fix)
                if (this.events && typeof this.events.initEventDelegation === 'function') {
                    this.events.initEventDelegation();
                    console.log('✅ Task click event delegation initialized');
                }

                // Phase 3 - No window.* exports (main script handles exposure)
                // Expose classes on instance so main script can assign to window.__*
                this.TaskValidator = TaskValidator;
                this.TaskUtils = TaskUtils;
                this.TaskRenderer = TaskRenderer;
                this.TaskEvents = TaskEvents;

                this.modulesLoaded = true;
                console.log('✅ Task sub-modules loaded successfully (versioned)');
            }

            // ✅ STEP 2: Wait for core systems (AppState + data) to be ready
            console.log('⏳ TaskDOMManager waiting for core systems...');
            await _deps.appInit?.waitForCore();
            console.log('✅ Core systems ready, TaskDOM ready for rendering');

            this.initialized = true;
            console.log('✅ TaskDOMManager initialized successfully');
        } catch (error) {
            console.error('❌ TaskDOMManager initialization failed:', error);
            console.error('❌ Error stack:', error.stack);
            _deps.showNotification?.('Task display may not work properly', 'warning');

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
                if (typeof this.deps.showTaskOptions === 'function' && typeof this.deps.hideTaskOptions === 'function') {
                    taskItem.removeEventListener('mouseenter', this.deps.showTaskOptions);
                    taskItem.removeEventListener('mouseleave', this.deps.hideTaskOptions);
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
    // Warning Helpers (for important but non-critical deps)
    // ============================================

    /**
     * Warn about missing dependency but return null
     * Used for important deps that won't crash but should be provided
     */
    _warnMissing(depName) {
        console.warn(`⚠️ TaskDOMManager: ${depName} not injected - some features may not work correctly`);
        return null;
    }

    /**
     * Warn about missing dependency and return a fallback function
     * Used for deps that have reasonable fallback behavior
     */
    _warnMissingWithFallback(depName, fallbackFn) {
        console.warn(`⚠️ TaskDOMManager: ${depName} not injected - using fallback`);
        return fallbackFn;
    }

    /**
     * Warn about missing optional dependency and return empty object
     * Used for optional feature modules that may not be injected
     */
    _warnMissingOptional(depName) {
        // These deps load in later boot phases - don't warn for expected late-loading deps
        const lateLoadingDeps = ['dueDates', 'reminders', 'recurringPanel', 'taskCore'];
        if (!lateLoadingDeps.includes(depName)) {
            console.warn(`⚠️ TaskDOMManager: Optional dependency ${depName} not injected`);
        }
        return {};
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
            // Recurring tasks CAN show pin if user manually disabled deleteWhenComplete
            if (!finalDeleteWhenComplete) {
                taskItem.classList.add("kept-task");
            }
        } else {
            // Cycle mode: show red X ONLY if opted IN (deleteWhenComplete=true)
            // BUT recurring tasks never show ❌ (recurring symbol indicates deletion)
            if (finalDeleteWhenComplete && !isRecurring) {
                taskItem.classList.add("show-delete-indicator");
            }
            // Recurring tasks show pin 📌 if user manually disabled deleteWhenComplete
            if (!finalDeleteWhenComplete && isRecurring) {
                taskItem.classList.add("kept-task");
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

        // Use revealTaskButtons from injected deps
        if (typeof this.deps.revealTaskButtons === 'function') {
            this.deps.revealTaskButtons(taskItem);
        } else {
            console.warn('⚠️ revealTaskButtons not injected');
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

            // Use safeAddEventListener to prevent duplicate listeners (no window.* fallback)
            const safeAdd = this.deps.safeAddEventListener;
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

        // ✅ Get button visibility settings for this cycle (no window.* fallback)
        const visibleOptions = currentCycle.taskOptionButtons || this.deps.DEFAULT_TASK_OPTION_BUTTONS || {};

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

        // Click handler - use deps (injected via setTaskDOMManagerDependencies)
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
        button._clickHandler = (e) => {
            e.stopPropagation();
            const customizer = this.deps.taskOptionsCustomizer;
            if (customizer) {
                // ✅ Always use the active cycle ID from AppState
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

        // Keyboard handler
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
     */
    createTaskButton(buttonConfig, taskContext, buttonContainer) {
        const { class: btnClass, icon, toggle = false, show } = buttonConfig;
        const { assignedTaskId, currentCycle, settings, remindersEnabled, recurring, highPriority, deleteWhenComplete } = taskContext;

        const button = document.createElement("button");
        button.classList.add("task-btn", btnClass);
        button.innerHTML = icon;
        button.setAttribute("type", "button");

        // ✅ Move arrows: don't add .hidden class - CSS handles visibility via
        // #taskList[data-move-arrows] attribute (O(1) CSS-driven approach)
        // Other buttons: use .hidden class when not shown
        if (btnClass !== "move-up" && btnClass !== "move-down" && !show) {
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

        // Keyboard navigation with safeAddEventListener
        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
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
            // ✅ Setup recurring button handler (from injected deps)
            if (typeof this.deps.setupRecurringButtonHandler === 'function') {
                this.deps.setupRecurringButtonHandler(button, taskContext);
            } else {
                // Fallback to internal method if not injected
                this.setupRecurringButtonHandler(button, taskContext);
            }
        } else if (btnClass === "enable-task-reminders") {
            // ✅ Use setupReminderButtonHandler from injected deps
            if (typeof this.deps.setupReminderButtonHandler === 'function') {
                this.deps.setupReminderButtonHandler(button, taskContext);
            } else {
                console.warn('⚠️ setupReminderButtonHandler not injected - reminders module may not be loaded');
            }
        } else if (btnClass === "delete-when-complete-btn") {
            // ✅ Setup delete-when-complete button handler
            this.setupDeleteWhenCompleteButtonHandler(button, taskContext);
        } else if (btnClass === "move-up" || btnClass === "move-down") {
            // ✅ Skip attaching old handlers to move buttons - using event delegation
            console.log(`🔄 Skipping old handler for ${btnClass} - using event delegation`);
        } else {
            // Use handleTaskButtonClick from injected deps with safeAddEventListener
            if (typeof this.deps.handleTaskButtonClick === 'function') {
                const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
                safeAdd(button, "click", this.deps.handleTaskButtonClick);
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

        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
        button._deleteWhenCompleteClickHandler = async (e) => {
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

            // ✅ Allow toggling delete-when-complete on recurring tasks
            // If disabled, show pin indicator - task will be kept on reset (won't respawn until re-enabled)
            if (isRecurring && !newState) {
                // Show info notification (not a blocking modal)
                _deps.showNotification?.(
                    "📌 This recurring task will be kept on reset instead of respawning.",
                    "info",
                    3000
                );
            }

            // ✅ Update state and DOM using centralized functions
            if (!this.deps.AppState?.isReady?.()) {
                console.error('❌ AppState not available for delete-when-complete toggle');
                _deps.showNotification?.('Feature temporarily unavailable', 'error', 3000);
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

                    // Update visual indicators (must handle recurring tasks properly)
                    if (isToDoMode) {
                        taskItem.classList.remove('show-delete-indicator');
                        taskItem.classList.toggle('kept-task', !newState);
                    } else {
                        // Cycle mode: handle recurring vs non-recurring differently
                        if (newState && !isRecurring) {
                            // Non-recurring with deleteWhenComplete=true: show red X
                            taskItem.classList.add('show-delete-indicator');
                            taskItem.classList.remove('kept-task');
                        } else {
                            taskItem.classList.remove('show-delete-indicator');
                            // Recurring with deleteWhenComplete=false: show pin
                            if (!newState && isRecurring) {
                                taskItem.classList.add('kept-task');
                            } else {
                                taskItem.classList.remove('kept-task');
                            }
                        }
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
            _deps.showNotification?.(message, "info", 2000);
        };
        safeAdd(button, "click", button._deleteWhenCompleteClickHandler);
    }

    /**
     * Handle disabling recurring for a task (called from confirmation modal)
     * @param {string} assignedTaskId - The task ID
     * @param {HTMLElement} taskItem - The task DOM element
     * @param {HTMLElement} button - The delete-when-complete button
     */
    async handleDisableRecurringForTask(assignedTaskId, taskItem, button) {
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

            _deps.showNotification?.("Recurring disabled for this task", "info", 2000);
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
        if (typeof this.deps.createDueDateInput === 'function') {
            dueDateInput = this.deps.createDueDateInput(assignedTaskId, dueDate, autoResetEnabled, currentCycle, activeCycle);
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
        checkbox.setAttribute("role", "checkbox");
        checkbox.setAttribute("aria-checked", checkbox.checked);

        // Add event listener using safe helper
        const addListener = this.deps.safeAddEventListener || ((el, event, handler) => el.addEventListener(event, handler));

        addListener(checkbox, "change", () => {
            // ✅ Enable undo system on first user interaction
            if (typeof this.deps.enableUndoSystemOnFirstInteraction === 'function') {
                this.deps.enableUndoSystemOnFirstInteraction();
            }

            if (typeof this.deps.handleTaskCompletionChange === 'function') {
                this.deps.handleTaskCompletionChange(checkbox);
            }

            if (typeof this.deps.checkMiniCycle === 'function') {
                this.deps.checkMiniCycle();
            }

            _deps.autoSave?.(null, true);  // ✅ Force immediate save on task completion

            if (typeof this.deps.triggerLogoBackground === 'function') {
                this.deps.triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
            }

            // ✅ Update undo/redo button states
            if (typeof this.deps.updateUndoRedoButtons === 'function') {
                this.deps.updateUndoRedoButtons();
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

        const safeAdd = this.deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
        button._recurringClickHandler = (event) => {
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

            // ✅ Check template existence AND button state (handles async race condition)
            const hasRecurringTemplate = freshCycle?.recurringTemplates?.[assignedTaskId];
            const isButtonActive = button.classList.contains('active');
            // Use button state as fallback if template doesn't exist yet (async update in progress)
            const isCurrentlyRecurring = !!hasRecurringTemplate || isButtonActive;
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
                if (this.deps.handleRecurringTaskActivation) {
                    this.deps.handleRecurringTaskActivation(task, freshTaskContext, button);
                }
                // ✅ Immediately sync delete-on-complete button to show active (recurring = delete on complete)
                const deleteBtn = taskItem?.querySelector('.delete-when-complete-btn');
                if (deleteBtn) {
                    deleteBtn.classList.add('active', 'delete-when-complete-active');
                    deleteBtn.setAttribute('aria-pressed', 'true');
                }
                if (taskItem) {
                    taskItem.dataset.deleteWhenComplete = 'true';
                    // Remove any kept-task or show-delete-indicator (recurring has its own indicator)
                    taskItem.classList.remove('kept-task', 'show-delete-indicator');
                }
            } else {
                if (this.deps.handleRecurringTaskDeactivation) {
                    this.deps.handleRecurringTaskDeactivation(task, freshTaskContext, assignedTaskId);
                }
                // ✅ Immediately sync delete-on-complete button to mode defaults
                const isToDoMode = freshCycle?.deleteCheckedTasks === true;
                const defaultDeleteState = isToDoMode; // todo=true, cycle=false
                const deleteBtn = taskItem?.querySelector('.delete-when-complete-btn');
                if (deleteBtn) {
                    deleteBtn.classList.toggle('active', defaultDeleteState);
                    deleteBtn.classList.toggle('delete-when-complete-active', defaultDeleteState);
                    deleteBtn.setAttribute('aria-pressed', defaultDeleteState.toString());
                }
                if (taskItem) {
                    taskItem.dataset.deleteWhenComplete = defaultDeleteState.toString();
                    taskItem.classList.remove('recurring');
                    // Update visual indicators based on mode
                    if (isToDoMode) {
                        taskItem.classList.remove('show-delete-indicator');
                        taskItem.classList.toggle('kept-task', !defaultDeleteState);
                    } else {
                        taskItem.classList.toggle('show-delete-indicator', defaultDeleteState);
                        taskItem.classList.remove('kept-task');
                    }
                }
            }

            // ✅ Update panel visibility
            if (this.deps.recurringPanel?.updateRecurringPanelButtonVisibility) {
                this.deps.recurringPanel.updateRecurringPanelButtonVisibility();
            }

            if (this.deps.recurringPanel?.updateRecurringPanel) {
                this.deps.recurringPanel.updateRecurringPanel();
            }
        };
        safeAdd(button, "click", button._recurringClickHandler);
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
        TaskUtils.setupFinalTaskInteractions(taskItem, isLoading, {
            remindOverdueTasks: this.deps.remindOverdueTasks,
            enableDragAndDropOnTask: this.deps.enableDragAndDropOnTask,
            updateMoveArrowsVisibility: this.deps.updateMoveArrowsVisibility
        });

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
        if (typeof this.deps.updateRecurringPanelButtonVisibility === 'function') {
            this.deps.updateRecurringPanelButtonVisibility();
        }

        // ✅ Update move arrows (first/last task may have changed)
        if (typeof this.deps.updateMoveArrowsVisibility === 'function') {
            this.deps.updateMoveArrowsVisibility();
        }

        if (shouldSave) _deps.autoSave?.();
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
    // ✅ DI-pure: Only check module-level instance
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

    // ✅ Verify sub-module classes are available (DI-pure: module-level only)
    if (!TaskUtils || !TaskValidator || !TaskRenderer || !TaskEvents) {
        const error = new Error('TaskDOMManager sub-modules not loaded properly');
        console.error('❌', error.message, {
            TaskUtils: !!TaskUtils,
            TaskValidator: !!TaskValidator,
            TaskRenderer: !!TaskRenderer,
            TaskEvents: !!TaskEvents
        });
        throw error;
    }

    // DI-pure - No window.* exports (main script handles exposure)
    console.log('✅ TaskDOMManager initialization verified - all sub-modules loaded');
    return taskDOMManager;
}

// ============================================
// Wrapper Functions (Legacy Compatibility Layer)
//
// These functions exist so older code that expects
// global functions can still work.
//
// - Core class: TaskDOMManager (DI-pure via this.deps.*)
// - New code: import from this module and go through manager
// - Old code: still calls these wrapper functions
//
// DI-pure: No window.* fallbacks - module-level instances only
// ============================================

// ============================================
// GROUP 1: Validation Wrappers
// ============================================

/**
 * Validate and sanitize task input
 * ✅ DELEGATES TO: taskValidation.js module
 */
function validateAndSanitizeTaskInput(taskText) {
    if (!taskDOMManager?.validator?.validateAndSanitizeTaskInput) {
        console.warn('⚠️ Validator not ready, using fallback');
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
    const AppState = _deps.AppState; // Use injected AppState from module deps
    if (!TaskUtils) {
        console.warn('⚠️ TaskUtils not initialized yet');
        return {};
    }
    return TaskUtils.buildTaskContext(taskItem, taskId, AppState);
}

function extractTaskDataFromDOM() {
    if (typeof TaskUtils?.extractTaskDataFromDOM === 'function') {
        return TaskUtils.extractTaskDataFromDOM();
    }

    // 🔁 Fallback: local DOM extraction so autosave/directSave still works
    console.warn('⚠️ TaskUtils not initialized yet, using inline fallback');

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
    // Use module deps for DI-pure pattern
    const loadMiniCycleData = _deps.loadMiniCycleData;
    const generateId = _deps.generateId;
    if (!TaskUtils) {
        console.warn('⚠️ TaskUtils not initialized yet');
        return null;
    }
    return TaskUtils.loadTaskContext(
        taskTextTrimmed,
        taskId,
        taskOptions,
        isLoading,
        loadMiniCycleData,
        generateId
    );
}

function scrollToNewTask(taskList) {
    if (!TaskUtils) {
        console.warn('⚠️ TaskUtils not initialized yet');
        return;
    }
    TaskUtils.scrollToNewTask(taskList);
}

function handleOverdueStyling(taskItem, completed) {
    if (!TaskUtils) {
        console.warn('⚠️ TaskUtils not initialized yet');
        return;
    }
    TaskUtils.handleOverdueStyling(taskItem, completed);
}

function setupFinalTaskInteractions(taskItem, isLoading) {
    if (!TaskUtils) {
        console.warn('⚠️ TaskUtils not initialized yet');
        return;
    }
    TaskUtils.setupFinalTaskInteractions(taskItem, isLoading);
}

function createOrUpdateTaskData(taskContext) {
    // Use the wrapper function from taskUtils.js that has _deps wired (includes saveTaskToSchema25)
    if (!_createOrUpdateTaskDataFn) {
        console.warn('⚠️ createOrUpdateTaskData wrapper not initialized yet');
        return null;
    }
    return _createOrUpdateTaskDataFn(taskContext);
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
    return taskDOMManager.createTaskContentElements(taskContext);
}

function createTaskCheckbox(assignedTaskId, taskTextTrimmed, completed) {
    if (!taskDOMManager) {
        const fallbackCheckbox = document.createElement('input');
        fallbackCheckbox.id = `checkbox-fallback-${Date.now()}`;
        fallbackCheckbox.name = `task-fallback-${Date.now()}`;
        return fallbackCheckbox;
    }
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

function revealTaskButtons(taskItem, caller = 'three-dots-button') {
    if (!taskDOMManager?.events) return;
    taskDOMManager.events.revealTaskButtons(taskItem, caller);
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

/**
 * Wrapper for taskToAddTaskOptions from taskUtils.js
 * Converts task object to addTask options format
 * @param {Object} task - Task data object
 * @returns {Object} Options for addTask
 * @throws {Error} If called before taskDOM is initialized
 */
function taskToAddTaskOptions(task) {
    if (!_taskToAddTaskOptions) {
        // Don't return {} - that would cause addTask to generate new IDs and duplicate tasks!
        throw new Error('taskToAddTaskOptions called before taskDOM initialized - this would cause task duplication');
    }
    return _taskToAddTaskOptions(task);
}

// ============================================
// Exports
// ============================================

// Export for ES6 modules
export {
    initTaskDOMManager,
    // setTaskDOMManagerDependencies is already exported inline above
    // Group 1: Validation
    validateAndSanitizeTaskInput,
    // Group 2: Utilities
    buildTaskContext,
    extractTaskDataFromDOM,
    loadTaskContext,
    createOrUpdateTaskData,
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
    refreshTaskListUI,
    // Group 7: Task Utils (loaded from taskUtils.js, exposed for other modules)
    taskToAddTaskOptions
};

// DI-pure module (no window.* fallbacks in wrappers)
console.log('🎨 TaskDOM module loaded (DI-pure, no window.* exports)');
