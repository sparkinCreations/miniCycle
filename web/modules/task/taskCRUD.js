/**
 * Task CRUD Operations Module (DI-Pure)
 *
 * Handles Create, Read, Update, Delete operations for tasks.
 * Extracted from taskCore.js for better maintainability.
 *
 * Features:
 * - Task creation with validation and storage quota checks
 * - Task editing with undo support
 * - Task deletion with confirmation
 * - Priority toggling
 *
 * @module task/taskCRUD
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
 * @see {@link file://../../../docs/developer-guides/DI_PATTERNS.md} - DI patterns
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').Cycle} Cycle
 * @typedef {import('../core/types.js').Schema25Data} Schema25Data
 * @typedef {import('../core/types.js').RecurringSettings} RecurringSettings
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} AddTaskOptions
 * @property {boolean} [completed=false] - Initial completion state
 * @property {boolean} [shouldSave=true] - Whether to persist immediately
 * @property {string|null} [dueDate=null] - Due date in ISO format
 * @property {boolean|null} [highPriority=null] - Priority flag (null uses default)
 * @property {boolean} [isLoading=false] - Loading from storage (skip animations/limits)
 * @property {boolean} [remindersEnabled=false] - Enable reminders for task
 * @property {boolean} [recurring=false] - Is this a recurring task
 * @property {string|null} [taskId=null] - Specific ID to use (for recurring)
 * @property {RecurringSettings} [recurringSettings={}] - Recurring configuration
 * @property {boolean} [deleteWhenComplete] - Delete on completion flag
 * @property {Object} [deleteWhenCompleteSettings] - Delete settings object
 * @property {boolean} [deferAppend=false] - Defer DOM append (for batch operations)
 * @property {HTMLElement|null} [targetContainer=null] - Custom container element
 */

import { createDIModule, optional } from '../core/diBase.js';
import { LIMITS, UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let estimateTaskSize, canAddToStorage, getStorageShortageMessage;

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
    requestUIUpdate: optional(null),
    // Task search visibility
    updateSearchVisibility: optional(null),
    getTaskCount: optional(null),
    // Reminders restart after task deletion
    startReminders: optional(null),
    // Notifications instance for color picker notification
    notifications: optional(null),
    // History logging
    logHistoryEvent: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, sanitizeInput: Function|null, showNotification: Function|null, showPromptModal: Function|null, showConfirmationModal: Function|null, captureStateSnapshot: Function|null, enableUndoSystemOnFirstInteraction: Function|null, validateAndSanitizeTaskInput: Function|null, loadTaskContext: Function|null, createOrUpdateTaskData: Function|null, createTaskDOMElements: Function|null, setupTaskInteractions: Function|null, finalizeTaskCreation: Function|null, requestUIUpdate: Function|null, updateSearchVisibility: Function|null, getTaskCount: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskCRUD
 * @param {Object} dependencies - Dependencies to inject
 * @param {MiniCycleState} [dependencies.AppState] - State manager
 * @param {Function} [dependencies.showNotification] - Notification function
 * @param {Function} [dependencies.sanitizeInput] - Input sanitization
 * @param {Function} [dependencies.showPromptModal] - Prompt modal function
 * @param {Function} [dependencies.showConfirmationModal] - Confirmation modal function
 * @param {Function} [dependencies.captureStateSnapshot] - Undo snapshot capture
 * @param {Function} [dependencies.requestUIUpdate] - UI Orchestrator update function
 * @returns {void}
 */
export function setTaskCRUDDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Wait for core initialization with timeout
 * Ensures compatibility with test environments
 * @returns {Promise<void>}
 * @private
 */
async function waitForCoreWithTimeout() {
    try {
        await Promise.race([
            _deps.appInit?.waitForCore(),
            new Promise((resolve) => setTimeout(resolve, UI_TIMEOUTS.NOTIFICATION_LONG))
        ]);
    } catch (error) {
        console.warn('Core wait: timeout or rejection:', error?.message || 'timeout');
    }
}

// Track one-time warnings for missing optional dependencies
const _warnedMissingDeps = new Set();

/**
 * Warn once about a missing optional dependency
 * @param {string} depName - Dependency name
 * @param {string} context - Where it was needed
 * @returns {void}
 * @private
 */
function warnMissingDep(depName, context) {
    const key = `${depName}-${context}`;
    if (_warnedMissingDeps.has(key)) return;
    _warnedMissingDeps.add(key);
    console.warn(`⚠️ [TaskCRUD] Missing optional dependency: ${depName} (needed for ${context}). Undo/redo may not work for this operation.`);
}

/**
 * Safely capture state snapshot with warning if unavailable
 * @param {Function|null} captureStateSnapshot - The snapshot function
 * @param {Object} state - Current state
 * @param {string} context - Context description for warning
 * @returns {void}
 * @private
 */
function safeCaptureSnapshot(captureStateSnapshot, state, context) {
    if (captureStateSnapshot) {
        captureStateSnapshot(state);
    } else {
        warnMissingDep('captureStateSnapshot', context);
    }
}

/**
 * Fallback confirmation modal using browser confirm
 * Used when showConfirmationModal dependency is not available
 * @param {Object} config - Modal configuration
 * @param {string} config.message - Confirmation message
 * @param {Function} [config.callback] - Callback with boolean result
 * @returns {void}
 * @private
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
 *
 * Handles:
 * - Input validation and sanitization
 * - Task limit checks (max per cycle)
 * - Storage quota verification
 * - DOM element creation
 * - State persistence
 *
 * @param {string} taskText - The text content of the task
 * @param {AddTaskOptions} [options={}] - Task creation options
 * @param {Object} [deps={}] - Dependency overrides
 * @returns {Promise<Task|undefined>} Created task or undefined on failure
 * @example
 * await addTaskImpl('Buy groceries', { highPriority: true }, deps);
 */
export async function addTaskImpl(taskText, options = {}, deps = {}) {
    const {
        completed = false,
        shouldSave = true,
        dueDate = null,
        highPriority = null,
        priorityColor = null,
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

        // Check task limit (skip during initial loading)
        if (!isLoading && AppState?.isReady?.()) {
            const state = AppState.get();
            const activeCycleId = state?.appState?.activeCycleId;
            const currentTasks = state?.data?.cycles?.[activeCycleId]?.tasks || [];

            if (currentTasks.length >= LIMITS.TASKS_PER_CYCLE) {
                console.warn(`Task limit reached (${LIMITS.TASKS_PER_CYCLE}). Cannot add more tasks.`);
                const showNotification = deps.showNotification || _deps.showNotification;
                showNotification?.(
                    getLabel('notify.taskLimitReached', { vars: { limit: LIMITS.TASKS_PER_CYCLE } }),
                    'warning',
                    UI_TIMEOUTS.NOTIFICATION_SLOW
                );
                return;
            }

            // Check storage quota
            const estimatedSize = estimateTaskSize(taskText);
            const storageCheck = canAddToStorage(estimatedSize);
            if (!storageCheck.allowed) {
                console.warn('Storage quota exceeded. Cannot add task.');
                const showNotification = deps.showNotification || _deps.showNotification;
                showNotification?.(
                    getStorageShortageMessage(storageCheck.shortfall),
                    'error',
                    UI_TIMEOUTS.NOTIFICATION_SLOW
                );
                return;
            }
        }

        // Input validation and sanitization
        const validateFn = deps.validateAndSanitizeTaskInput || _deps.validateAndSanitizeTaskInput;
        const taskInputEl = document.getElementById(DOM_IDS.TASK_INPUT);
        const validatedInput = validateFn?.(taskText);
        if (!validatedInput) {
            if (taskInputEl) taskInputEl.setAttribute('aria-invalid', 'true');
            console.warn('Task validation failed');
            return;
        }
        if (taskInputEl) taskInputEl.removeAttribute('aria-invalid');

        // Load and validate data context
        const loadContextFn = deps.loadTaskContext || _deps.loadTaskContext;
        const taskContext = loadContextFn?.(validatedInput, taskId, {
            completed, dueDate, highPriority, priorityColor, remindersEnabled, recurring, recurringSettings, deleteWhenComplete, deleteWhenCompleteSettings
        }, isLoading);
        if (!taskContext) {
            console.warn('Could not load task context');
            return;
        }

        // Create or update task data
        const createDataFn = deps.createOrUpdateTaskData || _deps.createOrUpdateTaskData;
        const taskData = createDataFn?.(taskContext);

        // Sync derived deleteWhenComplete back to context so DOM creation sees it
        if (taskData && taskContext.deleteWhenComplete === undefined) {
            taskContext.deleteWhenComplete = taskData.deleteWhenComplete;
            taskContext.deleteWhenCompleteSettings = taskData.deleteWhenCompleteSettings;
        }

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

        // Announce task addition to screen readers (skip during bulk loading)
        if (!isLoading) {
            const liveRegion = document.getElementById(DOM_IDS.LIVE_REGION);
            if (liveRegion) {
                liveRegion.textContent = getLabel('accessibility.taskAdded', { vars: { name: validatedInput } });
            }
        }

        // Update search visibility after adding task
        _deps.updateSearchVisibility?.(_deps.getTaskCount?.() ?? 0);

        // Log history event for task addition (skip during bulk loading)
        if (!isLoading && typeof _deps.logHistoryEvent === 'function') {
            _deps.logHistoryEvent('task_added', {
                taskName: validatedInput
            });
        }

        return result;

    } catch (error) {
        console.warn('Task creation failed:', error);
        _deps.showNotification?.(getLabel('notify.taskAddFailed'), 'warning');
    }
}

/**
 * Edit an existing task's text inline
 *
 * Replaces the task text with an editable input field.
 * Enter saves, Escape cancels, blur saves.
 * Captures undo snapshot before making changes.
 *
 * @param {HTMLElement} taskItem - The task DOM element to edit
 * @param {Object} [deps={}] - Dependency overrides
 * @returns {Promise<void>}
 */
export async function editTaskImpl(taskItem, deps = {}) {
    try {
        await waitForCoreWithTimeout();

        const taskLabel = taskItem.querySelector(DOM_SELECTORS.TASK_TEXT);
        if (!taskLabel) return;
        const oldText = taskLabel.textContent.trim();

        const sanitizeInput = deps.sanitizeInput || _deps.sanitizeInput || ((text) => text);
        const AppState = deps.AppState || _deps.AppState;
        const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
        const enableUndoSystemOnFirstInteraction = deps.enableUndoSystemOnFirstInteraction || _deps.enableUndoSystemOnFirstInteraction;
        const isTouchDevice = deps.isTouchDevice || _deps.isTouchDevice;

        // On touch devices, use a modal dialog instead of inline editing
        if (typeof isTouchDevice === 'function' && isTouchDevice()) {
            _editTaskModal(taskItem, taskLabel, oldText, {
                sanitizeInput, AppState, captureStateSnapshot,
                enableUndoSystemOnFirstInteraction, deps
            });
            return;
        }

        // Full-page overlay dims the entire app
        const pageOverlay = document.createElement('div');
        pageOverlay.className = DOM_CLASSES.EDIT_FOCUS_OVERLAY;
        const body = deps.getBody?.() || _deps.getBody?.() || document.body;
        body.appendChild(pageOverlay);

        // Raise the task-view container above the page overlay
        // (#task-view has transform which creates a stacking context)
        const taskView = taskItem.closest('#' + DOM_IDS.TASK_VIEW);
        if (taskView) taskView.classList.add(DOM_CLASSES.EDIT_FOCUS_RAISED);

        // Inner overlay dims non-edited tasks within the card
        const innerOverlay = document.createElement('div');
        innerOverlay.className = `${DOM_CLASSES.EDIT_FOCUS_OVERLAY} ${DOM_CLASSES.EDIT_FOCUS_INNER}`;
        const taskListContainer = taskItem.closest(DOM_SELECTORS.TASK_LIST_CONTAINER) || taskItem.parentElement;
        taskListContainer.appendChild(innerOverlay);

        taskItem.classList.add(DOM_CLASSES.EDIT_FOCUS_TARGET);
        // Double rAF ensures browser registers initial opacity:0 before transitioning
        requestAnimationFrame(() => requestAnimationFrame(() => {
            pageOverlay.classList.add(DOM_CLASSES.EDIT_FOCUS_ACTIVE);
            innerOverlay.classList.add(DOM_CLASSES.EDIT_FOCUS_ACTIVE);
        }));

        // Hide task text, insert inline input
        taskLabel.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'task-edit-input';
        input.value = oldText;
        input.setAttribute('aria-label', getLabel('action.editTaskTitle'));
        taskLabel.parentNode.insertBefore(input, taskLabel.nextSibling);

        // Disable drag while editing so the text cursor works
        const wasDraggable = taskItem.getAttribute('draggable');
        const wasWebkitUserDrag = taskItem.style.webkitUserDrag;
        const wasUserSelect = taskItem.style.userSelect;
        const wasCursor = taskItem.style.cursor;
        taskItem.setAttribute('draggable', 'false');
        taskItem.style.webkitUserDrag = 'none';
        taskItem.style.userSelect = 'text';
        taskItem.style.cursor = 'text';
        input.style.cursor = 'text';

        input.focus();
        input.select();

        // Hide task option buttons while editing
        const taskOptions = taskItem.querySelector(DOM_SELECTORS.TASK_OPTIONS);
        if (taskOptions) taskOptions.style.visibility = 'hidden';

        let finished = false;

        const finishEdit = async (cancelled) => {
            if (finished) return;
            finished = true;

            const newText = cancelled ? oldText : sanitizeInput(input.value.trim());
            input.remove();
            taskLabel.style.display = '';
            if (taskOptions) taskOptions.style.visibility = '';
            // Remove focus overlays (fallback timeout if transition is disabled)
            taskItem.classList.remove(DOM_CLASSES.EDIT_FOCUS_TARGET);
            if (taskView) taskView.classList.remove(DOM_CLASSES.EDIT_FOCUS_RAISED);
            pageOverlay.classList.remove(DOM_CLASSES.ACTIVE);
            innerOverlay.classList.remove(DOM_CLASSES.ACTIVE);
            const removeOverlays = () => { pageOverlay.remove(); innerOverlay.remove(); };
            pageOverlay.addEventListener('transitionend', removeOverlays, { once: true });
            setTimeout(removeOverlays, 500);
            // Restore draggable state
            if (wasDraggable) taskItem.setAttribute('draggable', wasDraggable);
            else taskItem.removeAttribute('draggable');
            taskItem.style.webkitUserDrag = wasWebkitUserDrag;
            taskItem.style.userSelect = wasUserSelect;
            taskItem.style.cursor = wasCursor;

            if (!newText || newText === oldText) return;

            // Enable undo system
            enableUndoSystemOnFirstInteraction?.();

            // Capture snapshot BEFORE changing text
            if (AppState?.isReady?.()) {
                const currentState = AppState.get();
                if (currentState) safeCaptureSnapshot(captureStateSnapshot, currentState, 'task edit');
            }

            // Update DOM
            taskLabel.textContent = newText;

            const taskId = taskItem.dataset.taskId;

            if (AppState?.isReady?.()) {
                await AppState.update(state => {
                    const cid = state.appState.activeCycleId;
                    const cycle = state.data.cycles[cid];
                    const t = cycle?.tasks?.find(t => t.id === taskId);
                    if (t) t.text = newText;
                }, true);
            } else {
                console.warn('⚠️ AppState not ready for task edit - state may be lost');
            }

            _deps.showNotification?.(getLabel('notify.taskRenamed', { vars: { name: newText } }), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);

            // Log history event for task edit
            if (typeof _deps.logHistoryEvent === 'function') {
                _deps.logHistoryEvent('task_edited', {
                    oldName: oldText,
                    newName: newText
                });
            }

            const requestUIUpdate = deps.requestUIUpdate || _deps.requestUIUpdate;
            requestUIUpdate?.({
                stats: true,
                progress: true,
                completeAllButton: true
            });
        };

        input.addEventListener('blur', () => finishEdit(false), { once: true });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); finishEdit(true); }
        });

    } catch (error) {
        console.warn('Task edit failed:', error);
        _deps.showNotification?.(getLabel('notify.taskEditFailed'), 'warning');
    }
}

/**
 * Mobile-only modal dialog for editing task names.
 * Uses the same .miniCycle-prompt-dialog pattern as routine creation.
 *
 * @param {HTMLElement} taskItem - The task DOM element
 * @param {HTMLElement} taskLabel - The .task-text span
 * @param {string} oldText - Current task name
 * @param {Object} ctx - Context with deps
 * @returns {void}
 * @private
 */
function _editTaskModal(taskItem, taskLabel, oldText, ctx) {
    const { sanitizeInput, AppState, captureStateSnapshot,
            enableUndoSystemOnFirstInteraction, deps } = ctx;

    const dialog = document.createElement('dialog');
    dialog.className = 'miniCycle-prompt-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const box = document.createElement('div');
    box.className = 'miniCycle-prompt-box';

    const titleEl = document.createElement('div');
    titleEl.className = 'miniCycle-prompt-title';
    titleEl.textContent = getLabel('action.editTaskTitle');
    box.appendChild(titleEl);

    const messageEl = document.createElement('div');
    messageEl.className = 'miniCycle-prompt-message';
    messageEl.textContent = getLabel('action.editTaskMessage');
    box.appendChild(messageEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'miniCycle-prompt-input';
    input.value = oldText;
    input.placeholder = getLabel('action.editTaskPlaceholder');
    box.appendChild(input);

    const buttons = document.createElement('div');
    buttons.className = 'miniCycle-prompt-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'miniCycle-btn-cancel';
    cancelBtn.textContent = getLabel('button.cancel');

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'miniCycle-btn-confirm';
    saveBtn.textContent = getLabel('button.save');

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);
    box.appendChild(buttons);
    dialog.appendChild(box);
    const body = deps.getBody?.() || _deps.getBody?.() || document.body;
    body.appendChild(dialog);

    // ── Event handlers ──
    const handleSave = async () => {
        const newText = sanitizeInput(input.value.trim());
        if (!newText) {
            input.classList.add(DOM_CLASSES.MINICYCLE_INPUT_ERROR);
            input.focus();
            return;
        }
        cleanup();
        dialog.close();
        dialog.remove();

        if (newText === oldText) return;

        enableUndoSystemOnFirstInteraction?.();

        if (AppState?.isReady?.()) {
            const currentState = AppState.get();
            if (currentState) safeCaptureSnapshot(captureStateSnapshot, currentState, 'task edit');
        }

        taskLabel.textContent = newText;
        const taskId = taskItem.dataset.taskId;

        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                const cid = state.appState.activeCycleId;
                const cycle = state.data.cycles[cid];
                const t = cycle?.tasks?.find(t => t.id === taskId);
                if (t) t.text = newText;
            }, true);
        }

        _deps.showNotification?.(getLabel('notify.taskRenamed', { vars: { name: newText } }), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);

        if (typeof _deps.logHistoryEvent === 'function') {
            _deps.logHistoryEvent('task_edited', { oldName: oldText, newName: newText });
        }

        const requestUIUpdate = deps.requestUIUpdate || _deps.requestUIUpdate;
        requestUIUpdate?.({ stats: true, progress: true, completeAllButton: true });
    };

    const handleCancel = () => {
        cleanup();
        dialog.close();
        dialog.remove();
    };

    const handleKeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    };

    const handleDialogCancel = (e) => {
        e.preventDefault();
        handleCancel();
    };

    const handleBackdropClick = (e) => {
        if (e.target === dialog) handleCancel();
    };

    // Wire listeners
    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', handleKeydown);
    dialog.addEventListener('cancel', handleDialogCancel);
    dialog.addEventListener('click', handleBackdropClick);

    const cleanup = () => {
        saveBtn.removeEventListener('click', handleSave);
        cancelBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keydown', handleKeydown);
        dialog.removeEventListener('cancel', handleDialogCancel);
        dialog.removeEventListener('click', handleBackdropClick);
    };

    dialog.showModal();
    input.focus();
    input.select();
}

/**
 * Delete a task with confirmation
 *
 * Shows a confirmation modal before deletion.
 * Also removes any associated recurring template.
 * Captures undo snapshot before deletion.
 *
 * @param {HTMLElement} taskItem - The task DOM element to delete
 * @param {Object} [deps={}] - Dependency overrides
 * @returns {Promise<void>}
 */
export async function deleteTaskImpl(taskItem, deps = {}) {
    try {
        await waitForCoreWithTimeout();

        const taskId = taskItem.dataset.taskId;
        const taskName = taskItem.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent || "Task";

        const showConfirmationModal = deps.showConfirmationModal || _deps.showConfirmationModal || fallbackConfirmModal;
        const AppState = deps.AppState || _deps.AppState;
        const captureStateSnapshot = deps.captureStateSnapshot || _deps.captureStateSnapshot;
        const enableUndoSystemOnFirstInteraction = deps.enableUndoSystemOnFirstInteraction || _deps.enableUndoSystemOnFirstInteraction;

        showConfirmationModal({
            title: getLabel('action.deleteTaskTitle'),
            message: getLabel('action.deleteTaskMessage', { vars: { name: taskName } }),
            confirmText: getLabel('button.delete'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: async (confirmDelete) => {
                if (!confirmDelete) {
                    _deps.showNotification?.(getLabel('notify.taskDeleteCancelled', { vars: { name: taskName } }), "show", UI_TIMEOUTS.NOTIFICATION_MEDIUM);
                    return;
                }

                // Enable undo system
                enableUndoSystemOnFirstInteraction?.();

                // Capture snapshot BEFORE deletion
                if (AppState?.isReady?.()) {
                    const currentState = AppState.get();
                    if (currentState) safeCaptureSnapshot(captureStateSnapshot, currentState, 'task delete');
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
                        }
                    }, true);

                    // Remove from DOM
                    taskItem.remove();

                    _deps.showNotification?.(getLabel('notify.taskDeleted', { vars: { name: taskName } }), "show", UI_TIMEOUTS.NOTIFICATION_MEDIUM);

                    // Log history event for task deletion
                    if (typeof _deps.logHistoryEvent === 'function') {
                        _deps.logHistoryEvent('task_deleted', {
                            taskName: taskName
                        });
                    }

                    // Request UI updates via UIOrchestrator
                    const requestUIUpdate = deps.requestUIUpdate || _deps.requestUIUpdate;
                    requestUIUpdate?.({
                        stats: true,
                        progress: true,
                        completeAllButton: true,
                        arrows: true
                    });

                    // Update search visibility after deleting task
                    _deps.updateSearchVisibility?.(_deps.getTaskCount?.() ?? 0);

                    // Restart reminders in case deleted task had reminders enabled
                    _deps.startReminders?.();
                } else {
                    console.warn('⚠️ AppState not ready for task deletion - state may be lost');
                    _deps.showNotification?.(getLabel('notify.taskDeleteFailed'), 'warning');
                }
            }
        });

    } catch (error) {
        console.warn('Task deletion failed:', error);
        _deps.showNotification?.(getLabel('notify.taskDeleteFailed'), 'warning');
    }
}

/**
 * Toggle task priority between high and normal
 *
 * Reads current priority from AppState (not DOM) to ensure accuracy.
 * Updates both DOM and state. Captures undo snapshot before change.
 *
 * @param {HTMLElement} taskItem - The task DOM element
 * @param {Object} [deps={}] - Dependency overrides
 * @returns {Promise<void>}
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

        // Capture snapshot BEFORE changing priority
        if (AppState?.isReady?.()) {
            safeCaptureSnapshot(captureStateSnapshot, currentState, 'priority toggle');
        }

        // Update DOM based on calculated state
        taskItem.classList.toggle(DOM_CLASSES.HIGH_PRIORITY, newHighPriority);
        const button = taskItem.querySelector(DOM_SELECTORS.PRIORITY_BTN);
        if (button) {
            button.classList.toggle(DOM_CLASSES.ACTIVE, newHighPriority);
            button.classList.toggle(DOM_CLASSES.PRIORITY_ACTIVE, newHighPriority);
            button.setAttribute("aria-pressed", newHighPriority.toString());
        }

        // Apply or clear per-task priority color via CSS custom property
        if (newHighPriority) {
            // Use task's own saved color, falling back to global default
            const taskColor = task.priorityColor ?? currentState?.settings?.priorityColor ?? '#dc3545';
            taskItem.style.setProperty('--task-priority-color', taskColor);
        } else {
            taskItem.style.removeProperty('--task-priority-color');
        }

        // ✅ Use AppState only (no localStorage fallback) - DI-pure
        if (AppState?.isReady?.()) {
            // Resolve the color now so it's persisted even if the user
            // dismisses the color picker without clicking a swatch
            const resolvedColor = newHighPriority
                ? (task.priorityColor ?? currentState?.settings?.priorityColor ?? '#dc3545')
                : null;

            AppState.update(state => {
                const cid = state.appState.activeCycleId;
                const cycle = state.data.cycles[cid];
                const t = cycle?.tasks?.find(t => t.id === taskId);
                if (t) {
                    t.highPriority = newHighPriority;
                    // Always persist the resolved color so it survives reload
                    if (resolvedColor) t.priorityColor = resolvedColor;
                }
                // Sync priority state to recurring template so recreated tasks keep the setting
                if (cycle?.recurringTemplates?.[taskId]) {
                    cycle.recurringTemplates[taskId].highPriority = newHighPriority;
                    if (resolvedColor) cycle.recurringTemplates[taskId].priorityColor = resolvedColor;
                }
            }, true);

            if (newHighPriority) {
                // Show color picker notification with a callback that saves the chosen color
                const notifications = _deps.notifications;
                const taskColor = task.priorityColor ?? currentState?.settings?.priorityColor ?? '#dc3545';
                if (notifications?.showPriorityColorPickerNotification) {
                    // onColorSelect closes over AppState and taskId — reliable save path
                    const onColorSelect = async (color) => {
                        if (AppState?.isReady?.()) {
                            await AppState.update(state => {
                                if (!state.settings) state.settings = {};
                                // Update global default so future new tasks start with this color
                                state.settings.priorityColor = color;
                                // Save to the specific task so it remembers its own color
                                const cid = state.appState?.activeCycleId;
                                const cycle = state.data?.cycles?.[cid];
                                const t = cycle?.tasks?.find(t => t.id === taskId);
                                if (t) t.priorityColor = color;
                                // Sync color to recurring template so recreated tasks keep the color
                                if (cycle?.recurringTemplates?.[taskId]) {
                                    cycle.recurringTemplates[taskId].priorityColor = color;
                                }
                            }, true);
                            // Update DOM immediately so the color change is visible without refresh
                            taskItem.style.setProperty('--task-priority-color', color);
                            _deps.logHistoryEvent?.('task_priority_color_changed', {
                                taskName: task.text,
                                priorityColor: color
                            });
                        }
                    };
                    notifications.showPriorityColorPickerNotification(taskColor, 8000, taskId, onColorSelect);
                } else {
                    _deps.showNotification?.(getLabel('notify.priorityEnabled'), 'warning', UI_TIMEOUTS.NOTIFICATION_BRIEF);
                }
                _deps.logHistoryEvent?.('task_priority_set', {
                    taskName: task.text,
                    priorityColor: taskColor
                });
            } else {
                _deps.showNotification?.(getLabel('notify.priorityRemoved'), 'info', UI_TIMEOUTS.NOTIFICATION_BRIEF);
                _deps.logHistoryEvent?.('task_priority_removed', {
                    taskName: task.text
                });
            }
        } else {
            console.warn('⚠️ AppState not ready for priority toggle - state may be lost');
        }

    } catch (error) {
        console.warn('Priority toggle failed:', error);
        _deps.showNotification?.(getLabel('notify.taskPriorityFailed'), 'warning');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize TaskCRUD module
 * Dynamically imports utilities with version cache-busting
 * @returns {Promise<void>}
 */
export async function initTaskCRUD() {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    estimateTaskSize = storageUtils.estimateTaskSize;
    canAddToStorage = storageUtils.canAddToStorage;
    getStorageShortageMessage = storageUtils.getStorageShortageMessage;

}

// ============================================================================
// MODULE INFO
// ============================================================================

