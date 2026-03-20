/**
 * miniCycle Task Core Module (DI-Pure)
 *
 * Main orchestrator for task operations. Coordinates task functionality
 * by delegating to focused sub-modules:
 * - taskCRUD.js - Create, Read, Update, Delete operations
 * - taskCompletion.js - Completion state and ordering
 * - taskCycleReset.js - Cycle reset and complete-all operations
 *
 * Architecture:
 * - NO window.* globals - all dependencies must be injected
 * - NO legacy fallbacks - strict DI only
 * - Uses dynamic versioned imports to avoid duplicate module loading
 *
 * @module task/taskCore
 * @see {@link file://../../../docs/developer-guides/ARCHITECTURE_OVERVIEW.md} - Architecture
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md} - DI patterns
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} TaskCoreAddOptions
 * @property {boolean} [completed=false] - Initial completion state
 * @property {boolean} [shouldSave=true] - Whether to persist immediately
 * @property {string|null} [dueDate=null] - Due date in ISO format
 * @property {boolean} [highPriority=false] - Priority flag
 * @property {boolean} [isLoading=false] - Loading from storage (skip animations)
 * @property {boolean} [remindersEnabled=false] - Enable reminders
 * @property {boolean} [recurring=false] - Is recurring task
 * @property {string|null} [taskId=null] - Specific ID (for recurring)
 * @property {Object} [recurringSettings={}] - Recurring configuration
 * @property {boolean} [deleteWhenComplete] - Delete on completion flag
 * @property {boolean} [deferAppend=false] - Defer DOM append
 * @property {HTMLElement|null} [targetContainer=null] - Custom container
 */

import { createDIModule, optional } from '../core/diBase.js';
import { TASK_TIMEOUTS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// MODULE-LEVEL STORAGE (populated by dynamic imports)
// ============================================================================

let _subModules = null;
let _initialized = false;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskCore', {
    appInit: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    autoSave: optional(null),
    sanitizeInput: optional(null),
    isPerformingUndoRedo: optional(null),
    showNotification: optional(null),
    updateStatsPanel: optional(null),
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    updateMainMenuHeader: optional(null),
    checkOverdueTasks: optional(null),
    updateArrowsInDOM: optional(null),
    updateMoveArrowsVisibility: optional(null),
    syncTaskDeleteWhenCompleteDOM: optional(null),
    recurringPanel: optional(null),
    updateRecurringPanelButtonVisibility: optional(null),
    enableDragAndDropOnTask: optional(null),
    checkMiniCycle: optional(null),
    incrementCycleCount: optional(null),
    animateProgressBarFill: optional(null),
    animateProgressBarEmpty: optional(null),
    showCompletionAnimation: optional(null),
    showClearAnimation: optional(null),
    pluginManager: optional(null),
    AppMeta: optional(null),
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null),
    isTouchDevice: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, loadMiniCycleData: Function|null, autoSave: Function|null, sanitizeInput: Function|null, isPerformingUndoRedo: Function|null, showNotification: Function|null, updateStatsPanel: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, updateMainMenuHeader: Function|null, checkOverdueTasks: Function|null, updateArrowsInDOM: Function|null, updateMoveArrowsVisibility: Function|null, syncTaskDeleteWhenCompleteDOM: Function|null, recurringPanel: Object|null, updateRecurringPanelButtonVisibility: Function|null, enableDragAndDropOnTask: Function|null, checkMiniCycle: Function|null, incrementCycleCount: Function|null, animateProgressBarFill: Function|null, animateProgressBarEmpty: Function|null, pluginManager: Object|null, AppMeta: Object|null, DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: Object|null, DEFAULT_TASK_OPTION_BUTTONS: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

// Singleton instance (initialized by initTaskCore)
let taskCoreInstance = null;

// ============================================================================
// DYNAMIC SUB-MODULE LOADING (versioned imports)
// ============================================================================

/**
 * Load all sub-modules with versioned imports
 * @param {string} version - Version string for cache busting
 */
async function loadSubModules(version) {
    if (_subModules) return _subModules;

    const [
        taskCRUDModule,
        taskCompletionModule,
        taskCycleResetModule
    ] = await Promise.all([
        import(`./taskCRUD.js?v=${version}`),
        import(`./taskCompletion.js?v=${version}`),
        import(`./taskCycleReset.js?v=${version}`)
    ]);

    _subModules = {
        // Task CRUD
        setTaskCRUDDependencies: taskCRUDModule.setTaskCRUDDependencies,
        addTaskImpl: taskCRUDModule.addTaskImpl,
        editTaskImpl: taskCRUDModule.editTaskImpl,
        deleteTaskImpl: taskCRUDModule.deleteTaskImpl,
        toggleTaskPriorityImpl: taskCRUDModule.toggleTaskPriorityImpl,

        // Task Completion
        setTaskCompletionDependencies: taskCompletionModule.setTaskCompletionDependencies,
        handleTaskCompletionChangeImpl: taskCompletionModule.handleTaskCompletionChangeImpl,
        saveCurrentTaskOrderImpl: taskCompletionModule.saveCurrentTaskOrderImpl,
        saveTaskToSchema25Impl: taskCompletionModule.saveTaskToSchema25Impl,

        // Task Cycle Reset
        setTaskCycleResetDependencies: taskCycleResetModule.setTaskCycleResetDependencies,
        resetTasksImpl: taskCycleResetModule.resetTasksImpl,
        handleCompleteAllTasksImpl: taskCycleResetModule.handleCompleteAllTasksImpl,
        deleteCompletedTasksImpl: taskCycleResetModule.deleteCompletedTasksImpl,
        markAllTasksCompleteImpl: taskCycleResetModule.markAllTasksCompleteImpl,
        clearAllTimeouts: taskCycleResetModule.clearAllTimeouts,
        isResetInProgress: taskCycleResetModule.isResetInProgress
    };

    return _subModules;
}

/**
 * Wire dependencies to all sub-modules
 * @param {Object} dependencies - Dependencies to propagate
 */
function wireSubModuleDependencies(dependencies) {
    if (!_subModules) {
        console.error('TaskCore: Sub-modules not loaded yet');
        return;
    }

    _subModules.setTaskCRUDDependencies(dependencies);
    _subModules.setTaskCompletionDependencies(dependencies);
    _subModules.setTaskCycleResetDependencies(dependencies);

}

/**
 * Set dependencies for TaskCore and all sub-modules.
 * Can be called before OR after initTaskCore.
 *
 * @param {Object} dependencies - Dependencies to inject
 * @param {MiniCycleState} [dependencies.AppState] - State manager
 * @param {Function} [dependencies.showNotification] - Notification function
 * @param {Function} [dependencies.sanitizeInput] - Input sanitization
 * @param {Object} [dependencies.AppMeta] - App metadata with version
 */
export function setTaskCoreDependencies(dependencies) {
    di.setDependencies(dependencies);

    // Forward dependencies to sub-modules if loaded
    if (_subModules) {
        wireSubModuleDependencies(dependencies);
    }

    // Also update existing instance if initialized
    if (taskCoreInstance && taskCoreInstance.deps) {
        for (const [key, value] of Object.entries(dependencies)) {
            if (value !== undefined) {
                taskCoreInstance.deps[key] = value;
            }
        }
    } else {
    }
}

// ============================================================================
// TASK CORE CLASS
// ============================================================================

/**
 * Main task operations coordinator
 *
 * Delegates to specialized sub-modules for actual implementation:
 * - taskCRUD.js for add/edit/delete
 * - taskCompletion.js for completion handling
 * - taskCycleReset.js for cycle reset operations
 *
 * @class TaskCore
 */
export class TaskCore {
    /**
     * Create TaskCore instance
     * @param {Object} [dependencies={}] - Dependency overrides
     */
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

        // Track active timeouts for cleanup
        this.activeTimeouts = new Set();

        // Store dependencies - NO window.* fallbacks (DI-pure)
        this.deps = {
            // State management
            AppState: resolvedDeps.AppState || null,

            // Data operations
            loadMiniCycleData: resolvedDeps.loadMiniCycleData || this.fallbackLoadData,
            sanitizeInput: resolvedDeps.sanitizeInput || ((text) => text),

            // Undo system state check
            isPerformingUndoRedo: resolvedDeps.isPerformingUndoRedo || (() => false),

            // UI updates
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            updateStatsPanel: resolvedDeps.updateStatsPanel || (() => {}),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
            refreshUIFromState: resolvedDeps.refreshUIFromState || (() => {}),

            // Undo system
            captureStateSnapshot: resolvedDeps.captureStateSnapshot || (() => {}),
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction || (() => {}),

            // Modal system
            showPromptModal: resolvedDeps.showPromptModal || this.fallbackPromptModal,
            showConfirmationModal: resolvedDeps.showConfirmationModal || this.fallbackConfirmModal,

            // DOM helpers
            getElementById: resolvedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelector: resolvedDeps.querySelector || ((selector) => document.querySelector(selector)),
            querySelectorAll: resolvedDeps.querySelectorAll || ((selector) => document.querySelectorAll(selector)),

            // Task DOM creation
            validateAndSanitizeTaskInput: resolvedDeps.validateAndSanitizeTaskInput || null,
            loadTaskContext: resolvedDeps.loadTaskContext || null,
            createOrUpdateTaskData: resolvedDeps.createOrUpdateTaskData || null,
            createTaskDOMElements: resolvedDeps.createTaskDOMElements || null,
            setupTaskInteractions: resolvedDeps.setupTaskInteractions || null,
            finalizeTaskCreation: resolvedDeps.finalizeTaskCreation || null,

            // Auto-save
            autoSave: resolvedDeps.autoSave || (() => {}),

            // Cycle completion
            incrementCycleCount: resolvedDeps.incrementCycleCount || null,
            helpWindowManager: resolvedDeps.helpWindowManager || null,
            showCompletionAnimation: resolvedDeps.showCompletionAnimation || null,
            showClearAnimation: resolvedDeps.showClearAnimation || null,
            updateCompletedTasksCount: resolvedDeps.updateCompletedTasksCount || null,
            updateUndoRedoButtons: resolvedDeps.updateUndoRedoButtons || null,
            animateProgressBarFill: resolvedDeps.animateProgressBarFill || null,
            animateProgressBarEmpty: resolvedDeps.animateProgressBarEmpty || null,
            pluginManager: resolvedDeps.pluginManager || null,

            // Task operations
            checkOverdueTasks: resolvedDeps.checkOverdueTasks || null,
            handleTaskListMovement: resolvedDeps.handleTaskListMovement || null,
            removeRecurringTasksFromCycle: resolvedDeps.removeRecurringTasksFromCycle || null,
            checkMiniCycle: resolvedDeps.checkMiniCycle || null,

            // Recurring system
            recurringCore: resolvedDeps.recurringCore || null,

            // Move arrows
            updateMoveArrowsVisibility: resolvedDeps.updateMoveArrowsVisibility || null,

            // Device detection
            isTouchDevice: resolvedDeps.isTouchDevice || null,

            // DOM body helper
            getBody: resolvedDeps.getBody || (() => document.body)
        };

        // Local instance state
        this.isResetting = false;

    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize task core system
     * Loads sub-modules and wires dependencies
     * @returns {Promise<void>}
     */
    async init() {

        try {
            await Promise.race([
                _deps.appInit?.waitForCore(),
                new Promise((resolve) => setTimeout(resolve, TASK_TIMEOUTS.CORE_INIT))
            ]);

            // Load sub-modules with versioned imports
            await loadSubModules(this.version);

            // Wire dependencies to sub-modules
            wireSubModuleDependencies(di.resolve());

            _initialized = true;
        } catch (error) {
            console.warn('Task core system initialization failed:', error);
            _deps.showNotification?.(getLabel('notify.taskSystemLimited'), 'warning');
        }
    }

    // ========================================================================
    // TIMEOUT MANAGEMENT
    // ========================================================================

    trackTimeout(timeoutId) {
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    clearTrackedTimeout(timeoutId) {
        clearTimeout(timeoutId);
        this.activeTimeouts.delete(timeoutId);
    }

    clearAllTimeouts() {
        for (const timeoutId of this.activeTimeouts) {
            clearTimeout(timeoutId);
        }
        this.activeTimeouts.clear();
        // Also clear sub-module timeouts
        _subModules?.clearAllTimeouts?.();
    }

    // ========================================================================
    // FALLBACK METHODS
    // ========================================================================

    fallbackNotification(message, type = 'info') {
    }

    fallbackLoadData() {
        console.warn('loadMiniCycleData not available');
        return null;
    }

    fallbackPromptModal(config) {
        const result = prompt(config.message, config.defaultValue || '');
        if (result !== null && config.callback) {
            config.callback(result);
        }
    }

    fallbackConfirmModal(config) {
        const result = confirm(config.message);
        if (config.callback) {
            config.callback(result);
        }
    }

    // ========================================================================
    // CRUD OPERATIONS (delegated to taskCRUD.js)
    // ========================================================================

    /**
     * Add a new task to the active cycle
     * @param {string} taskText - Task description
     * @param {TaskCoreAddOptions} [options={}] - Task options
     * @returns {Promise<Task|undefined>} Created task or undefined if failed
     * @example
     * await taskCore.addTask('Buy groceries');
     * await taskCore.addTask('Important meeting', { highPriority: true });
     */
    async addTask(taskText, options = {}) {
        if (!_subModules?.addTaskImpl) {
            console.warn('TaskCore: addTaskImpl not loaded');
            return;
        }
        return _subModules.addTaskImpl(taskText, options, this.deps);
    }

    /**
     * Edit an existing task (shows prompt modal)
     * @param {HTMLElement} taskItem - Task DOM element
     * @returns {Promise<void>}
     */
    async editTask(taskItem) {
        if (!_subModules?.editTaskImpl) {
            console.warn('TaskCore: editTaskImpl not loaded');
            return;
        }
        return _subModules.editTaskImpl(taskItem, this.deps);
    }

    /**
     * Delete a task (shows confirmation modal)
     * @param {HTMLElement} taskItem - Task DOM element
     * @returns {Promise<void>}
     */
    async deleteTask(taskItem) {
        if (!_subModules?.deleteTaskImpl) {
            console.warn('TaskCore: deleteTaskImpl not loaded');
            return;
        }
        return _subModules.deleteTaskImpl(taskItem, this.deps);
    }

    /**
     * Toggle high priority flag on a task
     * @param {HTMLElement} taskItem - Task DOM element
     * @returns {Promise<void>}
     */
    async toggleTaskPriority(taskItem) {
        if (!_subModules?.toggleTaskPriorityImpl) {
            console.warn('TaskCore: toggleTaskPriorityImpl not loaded');
            return;
        }
        return _subModules.toggleTaskPriorityImpl(taskItem, this.deps);
    }

    // ========================================================================
    // COMPLETION OPERATIONS (delegated to taskCompletion.js)
    // ========================================================================

    /**
     * Handle task completion checkbox change
     * Updates state, reorders tasks, and triggers UI updates
     * @param {HTMLInputElement} checkbox - Task checkbox element
     * @returns {Promise<void>}
     */
    async handleTaskCompletionChange(checkbox) {
        if (!_subModules?.handleTaskCompletionChangeImpl) {
            console.warn('TaskCore: handleTaskCompletionChangeImpl not loaded');
            return;
        }
        return _subModules.handleTaskCompletionChangeImpl(checkbox, this.deps);
    }

    /**
     * Save current task order to state
     * Called after drag-drop reordering
     * @returns {Promise<void>}
     */
    async saveCurrentTaskOrder() {
        if (!_subModules?.saveCurrentTaskOrderImpl) {
            console.warn('TaskCore: saveCurrentTaskOrderImpl not loaded');
            return;
        }
        return _subModules.saveCurrentTaskOrderImpl(this.deps);
    }

    /**
     * Save task to Schema 2.5 format
     * @param {string} activeCycle - Active cycle ID
     * @param {Cycle} currentCycle - Current cycle data
     * @returns {void}
     */
    saveTaskToSchema25(activeCycle, currentCycle) {
        if (!_subModules?.saveTaskToSchema25Impl) {
            console.warn('TaskCore: saveTaskToSchema25Impl not loaded');
            return;
        }
        return _subModules.saveTaskToSchema25Impl(activeCycle, currentCycle, this.deps);
    }

    // ========================================================================
    // RESET OPERATIONS (delegated to taskCycleReset.js)
    // ========================================================================

    /**
     * Reset all tasks in current cycle (uncheck all)
     * Used when cycle is completed and auto-reset is enabled
     * @returns {Promise<void>}
     */
    async resetTasks() {
        if (_subModules?.isResetInProgress?.()) {
            return;
        }
        if (!_subModules?.resetTasksImpl) {
            console.warn('TaskCore: resetTasksImpl not loaded');
            return;
        }
        return _subModules.resetTasksImpl(this.deps);
    }

    /**
     * Handle "Complete All" button click
     * Completes remaining tasks and triggers cycle completion
     * @returns {Promise<void>}
     */
    async handleCompleteAllTasks() {
        if (!_subModules?.handleCompleteAllTasksImpl) {
            console.warn('TaskCore: handleCompleteAllTasksImpl not loaded');
            return;
        }
        return _subModules.handleCompleteAllTasksImpl(() => this.resetTasks(), this.deps);
    }

    /**
     * Delete completed tasks from cycle
     * @param {string} activeCycleId - Cycle ID
     * @param {Cycle} cycleData - Cycle data
     * @param {HTMLElement} taskList - Task list container
     * @returns {Promise<void>}
     * @private
     */
    async _deleteCompletedTasks(activeCycleId, cycleData, taskList) {
        if (!_subModules?.deleteCompletedTasksImpl) {
            console.warn('TaskCore: deleteCompletedTasksImpl not loaded');
            return;
        }
        return _subModules.deleteCompletedTasksImpl(activeCycleId, cycleData, taskList, this.deps);
    }

    /**
     * Mark all tasks as complete
     * @param {Cycle} cycleData - Cycle data
     * @param {HTMLElement} taskList - Task list container
     * @returns {void}
     * @private
     */
    _markAllTasksComplete(cycleData, taskList) {
        if (!_subModules?.markAllTasksCompleteImpl) {
            console.warn('TaskCore: markAllTasksCompleteImpl not loaded');
            return;
        }
        return _subModules.markAllTasksCompleteImpl(cycleData, taskList, () => this.resetTasks(), this.deps);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the task core module with dependencies
 * @param {object} dependencies - Dependency injection configuration
 * @returns {Promise<TaskCore>} The initialized TaskCore instance
 */
export async function initTaskCore(dependencies = {}) {
    if (!taskCoreInstance) {
        try {
            taskCoreInstance = new TaskCore(dependencies);
            await taskCoreInstance.init();
        } catch (e) {
            console.error('TaskCore initialization failed:', e);
            taskCoreInstance = null;

            if (dependencies.showNotification) {
                dependencies.showNotification(getLabel('notify.taskSystemInitFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SLOW);
            }
            throw e;
        }
    }
    return taskCoreInstance;
}

// ============================================================================
// WRAPPER FUNCTIONS (for cross-module compatibility)
// ============================================================================

/**
 * Add a new task (wrapper function)
 * @param {string} taskText - Task description
 * @param {TaskCoreAddOptions} [options={}] - Task options
 * @returns {Promise<Task|undefined>} Created task
 * @throws {Error} If TaskCore has not been initialized via initTaskCore()
 */
function addTask(taskText, options = {}) {
    if (!taskCoreInstance) {
        console.warn('TaskCore not initialized');
        return Promise.reject(new Error('TaskCore not initialized'));
    }
    return taskCoreInstance.addTask(taskText, options);
}

/**
 * Edit an existing task (wrapper function)
 * @param {HTMLElement} taskItem - Task DOM element
 * @returns {Promise<void>|undefined}
 */
function editTask(taskItem) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.editTask(taskItem);
}

/**
 * Delete a task (wrapper function)
 * @param {HTMLElement} taskItem - Task DOM element
 * @returns {Promise<void>|undefined}
 */
function deleteTask(taskItem) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.deleteTask(taskItem);
}

/**
 * Toggle task priority (wrapper function)
 * @param {HTMLElement} taskItem - Task DOM element
 * @returns {Promise<void>|undefined}
 */
function toggleTaskPriority(taskItem) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.toggleTaskPriority(taskItem);
}

/**
 * Handle task completion change (wrapper function)
 * @param {HTMLInputElement} checkbox - Task checkbox
 * @returns {Promise<void>|undefined}
 */
function handleTaskCompletionChange(checkbox) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.handleTaskCompletionChange(checkbox);
}

/**
 * Save current task order (wrapper function)
 * @returns {Promise<void>|undefined}
 */
function saveCurrentTaskOrder() {
    if (!taskCoreInstance) return;
    return taskCoreInstance.saveCurrentTaskOrder();
}

/**
 * Save task to Schema 2.5 (wrapper function)
 * @param {string} cycleId - Cycle ID
 * @param {Cycle} cycleData - Cycle data
 * @returns {void}
 */
function saveTaskToSchema25(cycleId, cycleData) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.saveTaskToSchema25(cycleId, cycleData);
}

/**
 * Reset all tasks (wrapper function)
 * @returns {Promise<void>|undefined}
 */
function resetTasks() {
    if (!taskCoreInstance) return;
    return taskCoreInstance.resetTasks();
}

/**
 * Handle complete all tasks (wrapper function)
 * @returns {Promise<void>|undefined}
 */
function handleCompleteAllTasks() {
    if (!taskCoreInstance) return;
    return taskCoreInstance.handleCompleteAllTasks();
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    taskCoreInstance,
    addTask,
    editTask,
    deleteTask,
    toggleTaskPriority,
    handleTaskCompletionChange,
    saveCurrentTaskOrder,
    saveTaskToSchema25,
    resetTasks,
    handleCompleteAllTasks
};
