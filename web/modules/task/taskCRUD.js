/**
 * Task CRUD Operations Module (DI-Pure)
 * Handles Create, Read, Update, Delete operations for tasks
 *
 * Extracted from taskCore.js for better maintainability
 *
 * @module task/taskCRUD
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskCRUD', {
    appInit: optional(null),
    AppState: optional(null),
    sanitizeInput: optional(null),
    showNotification: optional(null),
    showPromptModal: optional(null),
    showConfirmationModal: optional(null),
    captureStateSnapshot: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null),
    validateAndSanitizeTaskInput: optional(null),
    loadTaskContext: optional(null),
    createOrUpdateTaskData: optional(null),
    createTaskDOMElements: optional(null),
    setupTaskInteractions: optional(null),
    finalizeTaskCreation: optional(null),
    // UIOrchestrator for coalesced UI updates
    requestUIUpdate: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskCRUD
 * @param {Object} dependencies - Dependencies to inject
 */
export function setTaskCRUDDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('Task CRUD dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Wait for core with timeout (for test environment compatibility)
 */
async function waitForCoreWithTimeout() {
    try {
        await Promise.race([
            _deps.appInit?.waitForCore(),
            new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
    } catch (error) {
        console.warn('Core wait timeout or error:', error);
    }
}

/**
 * Fallback prompt modal using browser prompt
 */
function fallbackPromptModal(config) {
    const result = prompt(config.message, config.defaultValue || '');
    if (result !== null && config.callback) {
        config.callback(result);
    }
}

/**
 * Fallback confirmation modal using browser confirm
 */
function fallbackConfirmModal(config) {
    const result = confirm(config.message);
    if (config.callback) {
        config.callback(result);
    }
}


// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Add a new task to the current cycle
 * @param {string} taskText - The text content of the task
 * @param {Object} options - Task options
 * @param {Object} deps - Resolved dependencies
 */
export async function addTaskImpl(taskText, options = {}, deps = {}) {
    const {
        completed = false,
        shouldSave = true,
        dueDate = null,
        highPriority = null,
        isLoading = false,
        remindersEnabled = false,
        recurring = false,
        taskId = null,
        recurringSettings = {},
        deleteWhenComplete = undefined,
        deleteWhenCompleteSettings = undefined,
        deferAppend = false,
        targetContainer = null
    } = options;

    try {
        // Wait for core to be ready
        await waitForCoreWithTimeout();

        // Validate AppState is available
        const AppState = deps.AppState || _deps.AppState;
        if (!AppState?.isReady?.()) {
            console.warn('AppState not ready, task creation may fail');
        }

        // Input validation and sanitization
        const validateFn = deps.validateAndSanitizeTaskInput || _deps.validateAndSanitizeTaskInput;
        const validatedInput = validateFn?.(taskText);
        if (!validatedInput) {
            console.warn('Task validation failed');
            return;
        }

        // Load and validate data context
        const loadContextFn = deps.loadTaskContext || _deps.loadTaskContext;
        const taskContext = loadContextFn?.(validatedInput, taskId, {
            completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings, deleteWhenComplete, deleteWhenCompleteSettings
        }, isLoading);
        if (!taskContext) {
            console.warn('Could not load task context');
            return;
        }

        // Create or update task data
        const createDataFn = deps.createOrUpdateTaskData || _deps.createOrUpdateTaskData;
        const taskData = createDataFn?.(taskContext);

        // Create DOM elements
        const createDOMFn = deps.createTaskDOMElements || _deps.createTaskDOMElements;
        const taskElements = createDOMFn?.(taskContext, taskData);

        // Setup task interactions and events
        const setupFn = deps.setupTaskInteractions || _deps.setupTaskInteractions;
        setupFn?.(taskElements, taskContext);

        // Finalize task creation
        const finalizeFn = deps.finalizeTaskCreation || _deps.finalizeTaskCreation;
        const result = finalizeFn?.(taskElements, taskContext, {
            shouldSave,
            isLoading,
            deferAppend,
            targetContainer
        });

        console.log('Task creation completed (Schema 2.5)');
        return result;

    } catch (error) {
        console.warn('Task creation failed:', error);
        _deps.showNotification?.('Could not add task - please try again', 'warning');
    }
}

/**
 * Edit an existing task's text
 * @param {HTMLElement} taskItem - The task DOM element
 * @param {Object} deps - Resolved dependencies
 */
export async function editTaskImpl(taskItem, deps = {}) {
    try {
        await waitForCoreWithTimeout();

        const taskLabel = taskItem.querySelector("span");
        const oldText = taskLabel.textContent.trim();

        const showPromptModal = deps.showPromptModal || _deps.showPromptModal || fallbackPromptModal;
        const sanitizeInput = deps.sanitizeInput || _deps.sanitizeInput || ((text) => text);
        const AppState = deps.AppState || _deps.AppState;
        const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
        const enableUndoSystemOnFirstInteraction = deps.enableUndoSystemOnFirstInteraction || _deps.enableUndoSystemOnFirstInteraction;

        showPromptModal({
            title: "Edit Task Name",
            message: "Rename this task:",
            placeholder: "Enter new task name",
            defaultValue: oldText,
            confirmText: "Save",
            cancelText: "Cancel",
            required: true,
            callback: async (newText) => {
                if (newText && newText.trim() !== oldText) {
                    const cleanText = sanitizeInput(newText.trim());

                    // Enable undo system
                    enableUndoSystemOnFirstInteraction?.();

                    // Capture snapshot BEFORE changing text
                    if (AppState?.isReady?.()) {
                        const currentState = AppState.get();
                        if (currentState) captureStateSnapshot?.(currentState);
                    }

                    // Update DOM
                    taskLabel.textContent = cleanText;

                    const taskId = taskItem.dataset.taskId;

                    // ✅ Use AppState only (no localStorage fallback) - DI-pure
                    if (AppState?.isReady?.()) {
                        await AppState.update(state => {
                            const cid = state.appState.activeCycleId;
                            const cycle = state.data.cycles[cid];
                            const t = cycle?.tasks?.find(t => t.id === taskId);
                            if (t) t.text = cleanText;
                        }, true);
                    } else {
                        console.warn('⚠️ AppState not ready for task edit - state may be lost');
                    }

                    _deps.showNotification?.(`Task renamed to "${cleanText}"`, "info", 1500);

                    // Request UI updates via UIOrchestrator
                    const requestUIUpdate = deps.requestUIUpdate || _deps.requestUIUpdate;
                    requestUIUpdate?.({
                        stats: true,
                        progress: true,
                        completeAllButton: true
                    });
                }
            }
        });

    } catch (error) {
        console.warn('Task edit failed:', error);
        _deps.showNotification?.('Could not edit task', 'warning');
    }
}

/**
 * Delete a task with confirmation
 * @param {HTMLElement} taskItem - The task DOM element
 * @param {Object} deps - Resolved dependencies
 */
export async function deleteTaskImpl(taskItem, deps = {}) {
    try {
        await waitForCoreWithTimeout();

        const taskId = taskItem.dataset.taskId;
        const taskName = taskItem.querySelector(".task-text")?.textContent || "Task";

        const showConfirmationModal = deps.showConfirmationModal || _deps.showConfirmationModal || fallbackConfirmModal;
        const AppState = deps.AppState || _deps.AppState;
        const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
        const enableUndoSystemOnFirstInteraction = deps.enableUndoSystemOnFirstInteraction || _deps.enableUndoSystemOnFirstInteraction;

        showConfirmationModal({
            title: "Delete Task",
            message: `Are you sure you want to delete "${taskName}"?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            callback: async (confirmDelete) => {
                if (!confirmDelete) {
                    _deps.showNotification?.(`"${taskName}" has not been deleted.`, "show", 2500);
                    return;
                }

                // Enable undo system
                enableUndoSystemOnFirstInteraction?.();

                // Capture snapshot BEFORE deletion
                if (AppState?.isReady?.()) {
                    const currentState = AppState.get();
                    if (currentState) captureStateSnapshot?.(currentState);
                }

                // ✅ Use AppState only (no localStorage fallback) - DI-pure
                if (AppState?.isReady?.()) {
                    await AppState.update(state => {
                        const cid = state.appState.activeCycleId;
                        const cycle = state.data.cycles[cid];
                        if (cycle?.tasks) {
                            const index = cycle.tasks.findIndex(t => t.id === taskId);
                            if (index !== -1) {
                                cycle.tasks.splice(index, 1);
                            }
                        }
                        // Also delete any corresponding recurring template
                        if (cycle?.recurringTemplates?.[taskId]) {
                            delete cycle.recurringTemplates[taskId];
                            console.log(`🗑️ Removed recurring template for deleted task ${taskId}`);
                        }
                    }, true);

                    // Remove from DOM
                    taskItem.remove();

                    _deps.showNotification?.(`Task "${taskName}" deleted.`, "show", 2500);

                    // Request UI updates via UIOrchestrator
                    const requestUIUpdate = deps.requestUIUpdate || _deps.requestUIUpdate;
                    requestUIUpdate?.({
                        stats: true,
                        progress: true,
                        completeAllButton: true,
                        arrows: true
                    });
                } else {
                    console.warn('⚠️ AppState not ready for task deletion - state may be lost');
                    _deps.showNotification?.('Could not delete task - please try again', 'warning');
                }
            }
        });

    } catch (error) {
        console.warn('Task deletion failed:', error);
        _deps.showNotification?.('Could not delete task', 'warning');
    }
}

/**
 * Toggle task priority (high/normal)
 * @param {HTMLElement} taskItem - The task DOM element
 * @param {Object} deps - Resolved dependencies
 */
export async function toggleTaskPriorityImpl(taskItem, deps = {}) {
    try {
        await waitForCoreWithTimeout();

        const AppState = deps.AppState || _deps.AppState;
        const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
        const enableUndoSystemOnFirstInteraction = deps.enableUndoSystemOnFirstInteraction || _deps.enableUndoSystemOnFirstInteraction;

        // Enable undo system
        enableUndoSystemOnFirstInteraction?.();

        const taskId = taskItem.dataset.taskId;

        // Read fresh state from AppState
        const currentState = AppState?.get();
        if (!currentState) {
            console.error('AppState not available for priority toggle');
            return;
        }

        const activeCycleId = currentState.appState?.activeCycleId;
        const freshCycle = currentState.data?.cycles?.[activeCycleId];
        const task = freshCycle?.tasks?.find(t => t.id === taskId);

        if (!task) {
            console.warn('Task not found for priority toggle:', taskId);
            return;
        }

        // Toggle based on AppState, not DOM
        const isCurrentlyHighPriority = task.highPriority === true;
        const newHighPriority = !isCurrentlyHighPriority;

        console.log('Toggling priority state:', {
            taskId: taskId,
            wasHighPriority: isCurrentlyHighPriority,
            willBeHighPriority: newHighPriority
        });

        // Capture snapshot BEFORE changing priority
        if (AppState?.isReady?.()) {
            captureStateSnapshot?.(currentState);
        }

        // Update DOM based on calculated state
        taskItem.classList.toggle("high-priority", newHighPriority);
        const button = taskItem.querySelector(".priority-btn");
        if (button) {
            button.classList.toggle("active", newHighPriority);
            button.classList.toggle("priority-active", newHighPriority);
            button.setAttribute("aria-pressed", newHighPriority.toString());
        }

        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        if (AppState?.isReady?.()) {
            AppState.update(state => {
                const cid = state.appState.activeCycleId;
                const cycle = state.data.cycles[cid];
                const t = cycle?.tasks?.find(t => t.id === taskId);
                if (t) t.highPriority = newHighPriority;
            }, true);

            _deps.showNotification?.(
                `Priority ${newHighPriority ? "enabled" : "removed"}.`,
                newHighPriority ? "error" : "info",
                1500
            );
        } else {
            console.warn('⚠️ AppState not ready for priority toggle - state may be lost');
        }

    } catch (error) {
        console.warn('Priority toggle failed:', error);
        _deps.showNotification?.('Could not toggle priority', 'warning');
    }
}

// ============================================================================
// MODULE INFO
// ============================================================================

console.log('Task CRUD module loaded (DI-pure)');
