/**
 * miniCycle Task DOM Manager
 *
 * Core DOM management for all task operations. Handles 30+ functions for
 * creating task elements, buttons, event listeners, and DOM patching.
 *
 * Architecture:
 * - Single instance stored in module-level `taskDOMManager` variable
 * - Sub-modules loaded dynamically: TaskValidator, TaskUtils, TaskRenderer, TaskEvents
 * - Resilient constructor pattern - degrades gracefully when dependencies missing
 *
 * Dependency Pattern (DI-Pure):
 * - this._rawDeps: Raw input from constructor (for sub-module pre-injection)
 * - this.deps: Normalized dependency bag with fallbacks (runtime access)
 * - NO window.* fallbacks - module-level instances only
 *
 * @module task/taskDOM
 * @version 1.0.0
 * @see {@link module:task/taskCRUD} - CRUD operations
 * @see {@link module:task/taskRenderer} - Rendering operations
 * @see {@link module:task/taskEvents} - Event handling
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 * @typedef {import('../core/types.js').RecurringSettings} RecurringSettings
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DOM_IDS, DOM_SELECTORS, DATA_SELECTORS } from '../core/constants.js';
import { ICONS } from '../utils/icons.js';
import { getLabel } from '../labels/labelResolver.js';

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
/** @type {{appInit: Object|null, AppState: Object|null, taskCore: Object|null, loadMiniCycleData: Function|null, autoSave: Function|null, showNotification: Function|null, sanitizeInput: Function|null, escapeHtml: Function|null, generateId: Function|null, syncTaskDeleteWhenCompleteDOM: Function|null, saveTaskToSchema25: Function|null, AppMeta: Object|null}} */
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
let TaskValidator, TaskUtils, TaskRenderer, TaskEvents, TaskButtons, TaskDOMPatch;
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
        this.buttons = null;
        this.patcher = null;
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

            // UI updates (use ?.() chaining when calling)
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            updateProgressBar: resolvedDeps.updateProgressBar,
            updateStatsPanel: resolvedDeps.updateStatsPanel,
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton,
            updateMainMenuHeader: resolvedDeps.updateMainMenuHeader,

            // Mode management
            getCurrentMode: resolvedDeps.getCurrentMode || this.fallbackGetMode,

            // Feature modules
            dueDates: resolvedDeps.dueDates || this._warnMissingOptional('dueDates'),
            reminders: resolvedDeps.reminders || this._warnMissingOptional('reminders'),
            recurringPanel: resolvedDeps.recurringPanel || this._warnMissingOptional('recurringPanel'),

            // Helper functions (use ?.() chaining when calling)
            incrementCycleCount: resolvedDeps.incrementCycleCount,
            showCompletionAnimation: resolvedDeps.showCompletionAnimation,
            helpWindowManager: resolvedDeps.helpWindowManager,
            autoSave: resolvedDeps.autoSave,
            captureStateSnapshot: resolvedDeps.captureStateSnapshot,

            // Task completion handlers
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction || null,
            handleTaskCompletionChange: resolvedDeps.handleTaskCompletionChange || null,
            checkMiniCycle: resolvedDeps.checkMiniCycle || null,
            triggerLogoBackground: resolvedDeps.triggerLogoBackground || null,
            triggerLogoScan: resolvedDeps.triggerLogoScan || null,
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
            safeAddEventListener: resolvedDeps.safeAddEventListener,
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

                // Get version for cache busting - use injected version only (strict DI)
                if (!this.version) {
                    console.warn('⚠️ TaskDOMManager: AppMeta.version not provided');
                }
                const version = this.version;
                console.log(`📦 Using version ${version} for sub-module imports`);

                // Load all 6 sub-modules with versioned imports
                console.log('📦 Starting Promise.all for sub-module imports...');
                const [
                    { TaskValidator: ValidatorClass },
                    { TaskUtils: UtilsClass, setTaskUtilsDependencies, createOrUpdateTaskData: createOrUpdateTaskDataWrapper, taskToAddTaskOptions },
                    { TaskRenderer: RendererClass },
                    { TaskEvents: EventsClass },
                    { TaskButtons: ButtonsClass },
                    { TaskDOMPatch: PatchClass }
                ] = await Promise.all([
                    import(`./taskValidation.js?v=${version}`),
                    import(`./taskUtils.js?v=${version}`),
                    import(`./taskRenderer.js?v=${version}`),
                    import(`./taskEvents.js?v=${version}`),
                    import(`./taskButtons.js?v=${version}`),
                    import(`./taskDOMPatch.js?v=${version}`)
                ]);
                console.log('✅ All 6 sub-modules imported successfully');

                // Store classes for module-level access
                TaskValidator = ValidatorClass;
                TaskUtils = UtilsClass;
                TaskRenderer = RendererClass;
                TaskEvents = EventsClass;
                TaskButtons = ButtonsClass;
                TaskDOMPatch = PatchClass;
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
                    TaskEvents: !!TaskEvents,
                    TaskButtons: !!TaskButtons,
                    TaskDOMPatch: !!TaskDOMPatch
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
                    triggerLogoBackground: this.deps.triggerLogoBackground,
                    triggerLogoScan: this.deps.triggerLogoScan
                });

                // ✅ CRITICAL: Initialize event delegation for task clicks
                // This sets up ONE listener for all tasks (memory leak fix)
                if (this.events && typeof this.events.initEventDelegation === 'function') {
                    this.events.initEventDelegation();
                    console.log('✅ Task click event delegation initialized');
                }

                // Initialize buttons module - handles all button creation and setup
                this.buttons = this._rawDeps.buttons || new TaskButtons({
                    AppState: this.deps.AppState,
                    safeAddEventListener: this.deps.safeAddEventListener,
                    showNotification: this.deps.showNotification,
                    taskOptionsCustomizer: this.deps.taskOptionsCustomizer,
                    setupRecurringButtonHandler: this.deps.setupRecurringButtonHandler,
                    setupReminderButtonHandler: this.deps.setupReminderButtonHandler,
                    handleTaskButtonClick: this.deps.handleTaskButtonClick,
                    GlobalUtils: this.deps.GlobalUtils,
                    DEFAULT_TASK_OPTION_BUTTONS: this.deps.DEFAULT_TASK_OPTION_BUTTONS
                });
                console.log('✅ TaskButtons module initialized');

                // Initialize patcher module - handles DOM patching without full re-renders
                this.patcher = this._rawDeps.patcher || new TaskDOMPatch({
                    sanitizeInput: this.deps.sanitizeInput
                });
                console.log('✅ TaskDOMPatch module initialized');

                // Phase 3 - No window.* exports (main script handles exposure)
                // Expose classes on instance so main script can assign to window.__*
                this.TaskValidator = TaskValidator;
                this.TaskUtils = TaskUtils;
                this.TaskRenderer = TaskRenderer;
                this.TaskEvents = TaskEvents;
                this.TaskButtons = TaskButtons;
                this.TaskDOMPatch = TaskDOMPatch;

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
            _deps.showNotification?.(getLabel('notify.taskDisplayLimited'), 'warning');

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

    fallbackGetMode() {
        return 'manual-cycle'; // Default to manual cycle
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
        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        if (taskList) {
            taskList.innerHTML = `<li class="task placeholder" style="padding: 20px; text-align: center; color: #888;">${getLabel('empty.loadingTasks')}</li>`;
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
            assignedTaskId, taskTextTrimmed, highPriority, priorityColor, recurring,
            recurringSettings, settings, autoResetEnabled, currentCycle, deleteWhenComplete, deleteWhenCompleteSettings
        } = taskContext;

        // Get required DOM elements
        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        const taskInput = this.deps.getElementById(DOM_IDS.TASK_INPUT);

        // Validate taskList exists
        if (!taskList) {
            console.error('❌ Task list element (#taskList) not found in DOM');
            throw new Error('Task list container not found');
        }

        // Create main task element
        const taskItem = this.createMainTaskElement(assignedTaskId, highPriority, recurring, recurringSettings, currentCycle, deleteWhenComplete, deleteWhenCompleteSettings);

        // Apply per-task priority color via CSS custom property (more reliable than borderLeftColor
        // because it doesn't conflict with the border-left shorthand in the stylesheet)
        if (highPriority && priorityColor) {
            taskItem.style.setProperty('--task-priority-color', priorityColor);
        }

        // Accessibility: descriptive aria-label for screen readers
        const completed = taskContext.completed || false;
        const statusText = completed ? getLabel('nav.completed') : getLabel('nav.notCompleted');
        const labelKey = recurring ? 'action.taskItemRecurring' : 'action.taskItemLabel';
        taskItem.setAttribute('aria-label', getLabel(labelKey, { vars: { name: taskTextTrimmed, status: statusText } }));

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

        // Assemble the task item (content first for correct tab order)
        taskItem.appendChild(taskContent);
        taskItem.appendChild(dueDateInput);
        if (threeDotsButton) taskItem.appendChild(threeDotsButton);
        taskItem.appendChild(buttonContainer);

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

        // stopImmediatePropagation stops other handlers on this same element too,
        // not just bubbling. Belt-and-suspenders against duplicate handler registrations.
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Use revealTaskButtons from injected deps
        if (typeof this.deps.revealTaskButtons === 'function') {
            this.deps.revealTaskButtons(taskItem);
        } else {
            console.warn('⚠️ revealTaskButtons not injected');
        }

        // Show customizer tip in help window (helpWindowManager is a factory function)
        this.deps.helpWindowManager?.()?.showCustomizerTip?.('three-dots');
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
            threeDotsButton.textContent = "⋮";
            threeDotsButton.setAttribute("title", getLabel('taskOption.showOptions'));
            threeDotsButton.setAttribute("aria-label", getLabel('taskOption.showOptions'));
            threeDotsButton.setAttribute("aria-expanded", "false");

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

            return threeDotsButton;
        }

        return null;
    }

    /**
     * Create task button container with all buttons
     * Delegates to TaskButtons module
     */
    createTaskButtonContainer(taskContext) {
        if (this.buttons) {
            return this.buttons.createTaskButtonContainer(taskContext);
        }
        // Fallback: create empty container if buttons module not loaded
        console.warn('⚠️ TaskButtons module not loaded, returning empty container');
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("task-options");
        return buttonContainer;
    }

    /**
     * Create a single task button
     * Delegates to TaskButtons module
     */
    createTaskButton(buttonConfig, taskContext, buttonContainer) {
        if (this.buttons) {
            return this.buttons.createTaskButton(buttonConfig, taskContext, buttonContainer);
        }
        // Fallback: create basic button if buttons module not loaded
        const { class: btnClass, icon, show } = buttonConfig;
        const button = document.createElement("button");
        button.classList.add("task-btn", btnClass);
        if (icon) button.textContent = icon;
        button.setAttribute("type", "button");
        if (!show) button.classList.add("hidden");
        return button;
    }

    /**
     * Handle disabling recurring for a task (called from confirmation modal)
     * Delegates to TaskButtons module
     * @param {string} assignedTaskId - The task ID
     * @param {HTMLElement} taskItem - The task DOM element
     * @param {HTMLElement} button - The delete-when-complete button
     */
    async handleDisableRecurringForTask(assignedTaskId, taskItem, button) {
        if (this.buttons) {
            return this.buttons.handleDisableRecurringForTask(assignedTaskId, taskItem, button);
        }
        console.warn('⚠️ TaskButtons module not loaded');
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
        checkbox.setAttribute("aria-label", getLabel('action.markTaskComplete', { vars: { name: taskTextTrimmed } }));

        // Add event listener using safe helper
        const addListener = this.deps.safeAddEventListener;

        addListener(checkbox, "change", () => {
            // ✅ Enable undo system on first user interaction
            if (typeof this.deps.enableUndoSystemOnFirstInteraction === 'function') {
                this.deps.enableUndoSystemOnFirstInteraction();
            }

            if (typeof this.deps.handleTaskCompletionChange === 'function') {
                this.deps.handleTaskCompletionChange(checkbox);
            }

            if (typeof this.deps.checkMiniCycle === 'function') {
                this.deps.checkMiniCycle({ lastToggledElement: checkbox.closest('.task') });
            }

            // Note: autoSave removed - handleTaskCompletionChange already updates AppState

            // Logo animation - scan effect in to-do mode, background flash otherwise
            if (checkbox.checked) {
                const isToDoMode = this.deps.AppState?.getState?.()?.settings?.isToDoMode;
                if (isToDoMode && typeof this.deps.triggerLogoScan === 'function') {
                    this.deps.triggerLogoScan(500);
                } else if (typeof this.deps.triggerLogoBackground === 'function') {
                    this.deps.triggerLogoBackground('green', 300);
                }
            }

            // ✅ Update undo/redo button states
            if (typeof this.deps.updateUndoRedoButtons === 'function') {
                this.deps.updateUndoRedoButtons();
            }

            console.log("✅ Task completion toggled — undo snapshot pushed.");
        });

        addListener(checkbox, "keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
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

        // Enter/Space toggles completion (a11y parity with checkbox)
        const addListener = this.deps.safeAddEventListener;
        addListener(taskLabel, "keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const checkbox = taskLabel.closest('.task-content')?.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event("change"));
                }
            }
        });

        // Add recurring icon if needed
        if (recurring) {
            const icon = document.createElement("span");
            icon.className = "recurring-indicator";
            icon.innerHTML = `<span class="icon" aria-hidden="true">${ICONS['sync-alt']}</span>`;
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

        const safeAdd = this.deps.safeAddEventListener;
        button._recurringClickHandler = async (event) => {
            // ✅ Prevent event from bubbling to checkbox
            event.stopPropagation();
            event.preventDefault();

            // Capture keyboard state before any async work (detail=0 means keyboard/programmatic)
            const wasKeyboardActivated = event.detail === 0;

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
                const taskLabel = taskItem.querySelector(DOM_SELECTORS.TASK_TEXT);
                if (taskLabel) {
                    let existingIcon = taskLabel.querySelector(DOM_SELECTORS.RECURRING_INDICATOR);

                    if (isNowRecurring && !existingIcon) {
                        const icon = document.createElement("span");
                        icon.className = "recurring-indicator";
                        icon.innerHTML = `<span class="icon" aria-hidden="true">${ICONS['sync-alt']}</span>`;
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
                    await this.deps.handleRecurringTaskActivation(task, freshTaskContext, button);
                }
                // ✅ Immediately sync delete-on-complete button to show active (recurring = delete on complete)
                const deleteBtn = taskItem?.querySelector(DOM_SELECTORS.DELETE_WHEN_COMPLETE_BTN);
                if (deleteBtn) {
                    deleteBtn.classList.add('active', 'delete-when-complete-active');
                    deleteBtn.setAttribute('aria-pressed', 'true');
                }
                if (taskItem) {
                    taskItem.dataset.deleteWhenComplete = 'true';
                    // Remove any kept-task or show-delete-indicator (recurring has its own indicator)
                    taskItem.classList.remove('kept-task', 'show-delete-indicator');
                }

                // Keyboard focus flow: stay on recurring button, Tab → notification → next task option
                if (wasKeyboardActivated) {
                    const notification = document.querySelector('.notification.recurring.show');
                    if (notification) {
                        const changeSettingsBtn = notification.querySelector('.show-quick-actions');
                        if (changeSettingsBtn) {
                            // Store return-focus context on the notification
                            notification._focusReturnContext = {
                                taskId: assignedTaskId,
                                sourceButtonClass: 'recurring-btn'
                            };

                            // Intercept next Tab on the recurring button to jump to "Change Settings"
                            const recurringBtn = button;
                            recurringBtn._notifTabHandler = (e) => {
                                if (e.key !== 'Tab' || e.shiftKey) return;
                                // Only redirect if notification is still visible
                                if (document.contains(notification) && notification.classList.contains('show')) {
                                    e.preventDefault();
                                    changeSettingsBtn.focus();
                                }
                                // One-shot: remove after first Tab press
                                recurringBtn.removeEventListener('keydown', recurringBtn._notifTabHandler);
                                recurringBtn._notifTabHandler = null;
                            };
                            recurringBtn.addEventListener('keydown', recurringBtn._notifTabHandler);

                            // Tab boundary handler: redirect focus when leaving notification
                            notification._focusTabHandler = (e) => {
                                if (e.key !== 'Tab') return;

                                const focusable = [...notification.querySelectorAll(
                                    'button, [role="radio"][tabindex="0"]'
                                )].filter(el => el.offsetParent !== null && getComputedStyle(el).display !== 'none');

                                if (focusable.length === 0) return;

                                const first = focusable[0];
                                const last = focusable[focusable.length - 1];

                                if (!e.shiftKey && document.activeElement === last) {
                                    e.preventDefault();
                                    restoreFocusToNextTaskOption(notification._focusReturnContext);
                                } else if (e.shiftKey && document.activeElement === first) {
                                    e.preventDefault();
                                    restoreFocusToTaskOptionButton(notification._focusReturnContext);
                                }
                            };
                            notification.addEventListener('keydown', notification._focusTabHandler);

                            // Handle notification removal while user is focused inside
                            const observer = new MutationObserver(() => {
                                if (!document.contains(notification)) {
                                    observer.disconnect();
                                    // Clean up the one-shot Tab handler if notification dismissed before Tab
                                    if (recurringBtn._notifTabHandler) {
                                        recurringBtn.removeEventListener('keydown', recurringBtn._notifTabHandler);
                                        recurringBtn._notifTabHandler = null;
                                    }
                                    if (!document.activeElement || document.activeElement === document.body) {
                                        restoreFocusToNextTaskOption(notification._focusReturnContext);
                                    }
                                }
                            });
                            if (notification.parentNode) {
                                observer.observe(notification.parentNode, { childList: true });
                            }
                        }
                    }
                }
            } else {
                if (this.deps.handleRecurringTaskDeactivation) {
                    this.deps.handleRecurringTaskDeactivation(task, freshTaskContext, assignedTaskId);
                }
                // ✅ Immediately sync delete-on-complete button to mode defaults
                const isToDoMode = freshCycle?.deleteCheckedTasks === true;
                const defaultDeleteState = isToDoMode; // todo=true, cycle=false
                const deleteBtn = taskItem?.querySelector(DOM_SELECTORS.DELETE_WHEN_COMPLETE_BTN);
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

        // Scroll behavior based on context and settings
        const state = this.deps.AppState?.get?.();
        if (isLoading) {
            // During page load: only scroll if setting is enabled (default: off for performance)
            const scrollOnLoad = state?.settings?.scrollOnLoad || false;
            if (scrollOnLoad) {
                TaskUtils.scrollToNewTask(taskList);
            }
        } else {
            // User-initiated add: scroll if setting is enabled (default: on)
            const scrollEnabled = state?.settings?.scrollToNewTask ?? true;
            if (scrollEnabled) {
                TaskUtils.scrollToNewTask(taskList);
            }
        }

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

        // Note: autoSave removed - task creation via createOrUpdateTaskData already updates AppState
    }

    // GROUP 6: RENDERING
    // ✅ MOVED TO: modules/task/taskRenderer.js
    // Use this.renderer.renderTasks(), this.renderer.refreshUIFromState(), etc.

    // ========================================================================
    // GROUP 7: PATCH/REMOVE APIs (delegated to TaskDOMPatch)
    // These provide O(1) DOM updates for single-task changes
    // ✅ MOVED TO: modules/task/taskDOMPatch.js
    // ========================================================================

    /**
     * Patch a single task's DOM to reflect state changes (O(1) operation)
     * @param {string} taskId - Task ID to patch
     * @param {Object} taskData - Current task data from state
     * @param {string[]} [changedFields] - Specific fields that changed (for optimization)
     */
    patchTask(taskId, taskData, changedFields = null) {
        if (this.patcher) {
            return this.patcher.patchTask(taskId, taskData, changedFields);
        }
        console.warn('🎨 TaskDOMPatch not initialized');
        return false;
    }

    /**
     * Remove a task from the DOM (O(1) operation)
     * @param {string} taskId - Task ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeTask(taskId) {
        if (this.patcher) {
            return this.patcher.removeTask(taskId);
        }
        console.warn('🎨 TaskDOMPatch not initialized');
        return false;
    }

    /**
     * Reorder tasks in DOM without full re-render
     * @param {string[]} taskIds - Task IDs in desired order
     * @returns {boolean} True if reordered successfully
     */
    applyTaskOrder(taskIds) {
        if (this.patcher) {
            return this.patcher.applyTaskOrder(taskIds);
        }
        console.warn('🎨 TaskDOMPatch not initialized');
        return false;
    }

    /**
     * Sync first/last task boundary markers (O(1) operation)
     * Used for CSS-driven arrow visibility
     */
    syncBoundaryMarkers() {
        if (this.patcher) {
            return this.patcher.syncBoundaryMarkers();
        }
    }

    /**
     * Get a task element by ID
     * @param {string} taskId
     * @returns {HTMLElement|null}
     */
    getTaskElement(taskId) {
        return document.querySelector(DATA_SELECTORS.taskById(taskId));
    }

    /**
     * Get all task elements
     * @returns {NodeList}
     */
    getAllTaskElements() {
        return document.querySelectorAll('#taskList > .task');
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
    // TaskUtils not available - return empty array (will be populated once TaskUtils loads)
    console.warn('⚠️ TaskUtils not initialized yet, returning empty array');
    return [];
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
// Focus Restoration Helpers (Recurring Notification)
// ============================================

/**
 * Restore focus to the next visible task option button after the source button.
 * Re-shows task options if they were hidden.
 */
function restoreFocusToNextTaskOption(context) {
    if (!context) return;
    const { taskId, sourceButtonClass } = context;
    const taskItem = document.querySelector(DATA_SELECTORS.taskById(taskId));
    if (!taskItem) return;

    // Re-show task options if hidden
    const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
    if (taskOptions) {
        taskOptions.classList.add('task-options-visible');
        taskOptions.classList.remove('task-options-force-hidden');
        taskOptions.querySelectorAll('button.task-btn').forEach(btn => {
            btn.tabIndex = 0;
        });
    }

    // Find the next visible button after the source
    const buttons = [...taskItem.querySelectorAll('button.task-btn')];
    const srcIndex = buttons.findIndex(btn => btn.classList.contains(sourceButtonClass));

    for (let i = srcIndex + 1; i < buttons.length; i++) {
        if (buttons[i].offsetParent !== null && !buttons[i].classList.contains('hidden')) {
            buttons[i].focus();
            return;
        }
    }

    // Fallback: focus task text
    taskItem.querySelector(DOM_SELECTORS.TASK_TEXT)?.focus();
}

/**
 * Restore focus to the source task option button itself (for Shift+Tab).
 * Re-shows task options if they were hidden.
 */
function restoreFocusToTaskOptionButton(context) {
    if (!context) return;
    const { taskId, sourceButtonClass } = context;
    const taskItem = document.querySelector(DATA_SELECTORS.taskById(taskId));
    if (!taskItem) return;

    const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
    if (taskOptions) {
        taskOptions.classList.add('task-options-visible');
        taskOptions.classList.remove('task-options-force-hidden');
        taskOptions.querySelectorAll('button.task-btn').forEach(btn => {
            btn.tabIndex = 0;
        });
    }

    const sourceBtn = taskItem.querySelector(`.${sourceButtonClass}`);
    if (sourceBtn) {
        sourceBtn.focus();
    }
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

    // Show customizer tip on long-press (mobile — every time, same as three-dots)
    if (caller === 'long-press') {
        taskDOMManager.deps.helpWindowManager?.()?.showCustomizerTip?.('three-dots');
    }
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
// GROUP 8: Patch/Remove Wrappers (for UIOrchestrator)
// ============================================

/**
 * Patch a single task's DOM to reflect state changes
 * @param {string} taskId - Task ID
 * @param {Object} taskData - Current task data from state
 * @param {string[]} [changedFields] - Specific fields that changed
 * @returns {boolean}
 */
function patchTask(taskId, taskData, changedFields) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return false;
    }
    return taskDOMManager.patchTask(taskId, taskData, changedFields);
}

/**
 * Remove a task from the DOM
 * @param {string} taskId - Task ID to remove
 * @returns {boolean}
 */
function removeTask(taskId) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return false;
    }
    return taskDOMManager.removeTask(taskId);
}

/**
 * Reorder tasks in DOM without full re-render
 * @param {string[]} taskIds - Task IDs in desired order
 * @returns {boolean}
 */
function applyTaskOrder(taskIds) {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return false;
    }
    return taskDOMManager.applyTaskOrder(taskIds);
}

/**
 * Sync first/last task boundary markers
 */
function syncBoundaryMarkers() {
    if (!taskDOMManager) {
        console.warn('⚠️ TaskDOMManager not initialized');
        return;
    }
    taskDOMManager.syncBoundaryMarkers();
}

/**
 * Get a task element by ID
 * @param {string} taskId
 * @returns {HTMLElement|null}
 */
function getTaskElement(taskId) {
    if (!taskDOMManager) return null;
    return taskDOMManager.getTaskElement(taskId);
}

/**
 * Get all task elements
 * @returns {NodeList}
 */
function getAllTaskElements() {
    if (!taskDOMManager) return document.querySelectorAll(DOM_SELECTORS.TASK_NOT_FOUND);
    return taskDOMManager.getAllTaskElements();
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
    taskToAddTaskOptions,
    // Group 8: Patch/Remove APIs (for UIOrchestrator)
    patchTask,
    removeTask,
    applyTaskOrder,
    syncBoundaryMarkers,
    getTaskElement,
    getAllTaskElements
};

// DI-pure module (no window.* fallbacks in wrappers)
console.log('🎨 TaskDOM module loaded (DI-pure, no window.* exports)');
