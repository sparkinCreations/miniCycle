/**
 * 🎯 miniCycle Task Core Module (DI-Pure)
 * Handles core task CRUD operations with graceful error handling
 *
 * Features:
 * - Task creation (addTask)
 * - Task editing (editTask)
 * - Task deletion (deleteTask)
 * - Task completion toggling
 * - Priority management
 * - Task reordering
 * - Batch operations (reset, complete all)
 * - Integration with Schema 2.5 data structure
 *
 * @module task/taskCore
 */

import { createDIModule, optional } from '../core/diBase.js';
import { ui, state } from '../core/appContext.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskCore', {
    appInit: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    sanitizeInput: optional(null),
    safeJSONParse: optional(null),
    safeJSONStringify: optional(null),
    safeLocalStorageGet: optional(null),
    safeLocalStorageSet: optional(null),
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
    AppMeta: optional(null),
    DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

// Singleton instance (initialized by initTaskCore)
let taskCoreInstance = null;

/**
 * Set dependencies for TaskCore.
 * Can be called before OR after initTaskCore - updates both module-level
 * deps and the existing instance if one exists.
 *
 * @param {Object} dependencies - Dependencies to inject
 */
export function setTaskCoreDependencies(dependencies) {
    di.setDependencies(dependencies);

    // Also update existing instance if initialized
    // IMPORTANT: Only assign deps that were actually passed (not ALL resolved deps)
    // Otherwise we'd overwrite existing deps like AppState with null
    if (taskCoreInstance && taskCoreInstance.deps) {
        for (const [key, value] of Object.entries(dependencies)) {
            if (value !== undefined) {
                taskCoreInstance.deps[key] = value;
            }
        }
        console.log('🎯 TaskCore instance deps updated:', Object.keys(dependencies));
    } else {
        console.log('🎯 TaskCore module deps set (pre-init):', Object.keys(dependencies));
    }
}

export class TaskCore {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

        // ✅ FIX #7: Track active timeouts for cleanup
        this.activeTimeouts = new Set();

        // Store dependencies - NO window.* fallbacks (DI-pure)
        // Priority: constructor > module deps > local fallback
        this.deps = {
            // State management
            AppState: resolvedDeps.AppState || null,

            // Data operations
            loadMiniCycleData: resolvedDeps.loadMiniCycleData || this.fallbackLoadData,
            sanitizeInput: resolvedDeps.sanitizeInput || ((text) => text),

            // Safe storage utilities (injected, no globals)
            safeJSONParse: resolvedDeps.safeJSONParse || ((str, fallback) => { try { return JSON.parse(str); } catch { return fallback; } }),
            safeJSONStringify: resolvedDeps.safeJSONStringify || ((obj, fallback) => { try { return JSON.stringify(obj); } catch { return fallback; } }),
            safeLocalStorageGet: resolvedDeps.safeLocalStorageGet || ((key, fallback) => { try { return localStorage.getItem(key); } catch { return fallback; } }),
            safeLocalStorageSet: resolvedDeps.safeLocalStorageSet || ((key, value) => { try { localStorage.setItem(key, value); } catch { console.warn('localStorage unavailable'); } }),

            // Undo system state check (injected function, no AppGlobalState)
            isPerformingUndoRedo: resolvedDeps.isPerformingUndoRedo || (() => false),

            // UI updates
            showNotification: resolvedDeps.showNotification || this.fallbackNotification,
            updateStatsPanel: resolvedDeps.updateStatsPanel || (() => console.log('⏭️ updateStatsPanel not available')),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => console.log('⏭️ updateProgressBar not available')),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => console.log('⏭️ checkCompleteAllButton not available')),
            refreshUIFromState: resolvedDeps.refreshUIFromState || (() => console.log('⏭️ refreshUIFromState not available')),

            // Undo system
            captureStateSnapshot: resolvedDeps.captureStateSnapshot || (() => console.log('⏭️ captureStateSnapshot not available')),
            enableUndoSystemOnFirstInteraction: resolvedDeps.enableUndoSystemOnFirstInteraction || (() => {}),

            // Modal system
            showPromptModal: resolvedDeps.showPromptModal || this.fallbackPromptModal,
            showConfirmationModal: resolvedDeps.showConfirmationModal || this.fallbackConfirmModal,

            // DOM helpers
            getElementById: resolvedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelector: resolvedDeps.querySelector || ((selector) => document.querySelector(selector)),
            querySelectorAll: resolvedDeps.querySelectorAll || ((selector) => document.querySelectorAll(selector)),

            // Task DOM creation (injected from taskDOM.js)
            validateAndSanitizeTaskInput: resolvedDeps.validateAndSanitizeTaskInput || null,
            loadTaskContext: resolvedDeps.loadTaskContext || null,
            createOrUpdateTaskData: resolvedDeps.createOrUpdateTaskData || null,
            createTaskDOMElements: resolvedDeps.createTaskDOMElements || null,
            setupTaskInteractions: resolvedDeps.setupTaskInteractions || null,
            finalizeTaskCreation: resolvedDeps.finalizeTaskCreation || null,

            // Auto-save
            autoSave: resolvedDeps.autoSave || (() => console.log('⏭️ autoSave not available')),

            // Cycle completion (used in resetTasks)
            incrementCycleCount: resolvedDeps.incrementCycleCount || null,
            helpWindowManager: resolvedDeps.helpWindowManager || null,
            showCompletionAnimation: resolvedDeps.showCompletionAnimation || null,
            updateCompletedTasksCount: resolvedDeps.updateCompletedTasksCount || null,
            updateUndoRedoButtons: resolvedDeps.updateUndoRedoButtons || null,

            // Task operations
            checkOverdueTasks: resolvedDeps.checkOverdueTasks || null,
            handleTaskListMovement: resolvedDeps.handleTaskListMovement || null,
            removeRecurringTasksFromCycle: resolvedDeps.removeRecurringTasksFromCycle || null,
            checkMiniCycle: resolvedDeps.checkMiniCycle || null,

            // Recurring system
            recurringCore: resolvedDeps.recurringCore || null,

            // Move arrows
            updateMoveArrowsVisibility: resolvedDeps.updateMoveArrowsVisibility || null
        };

        // Local instance state (previously on AppGlobalState)
        this.isResetting = false;

        console.log('🎯 TaskCore module initialized');
    }

    /**
     * Helper to resolve getter functions for late-initialized dependencies.
     * Some deps (like helpWindowManager) are passed as getter functions
     * because they don't exist at initialization time.
     *
     * @param {*} dep - The dependency (may be a getter function or direct value)
     * @returns {*} The resolved value
     */
    _resolveGetter(dep) {
        if (typeof dep === 'function' && dep.length === 0) {
            // It's a no-arg function (getter), call it to get the actual value
            try {
                return dep();
            } catch {
                return null;
            }
        }
        return dep;
    }

    /**
     * Initialize task core system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {
        console.log('🔄 Initializing task core system...');

        // Wait for core systems to be ready (with timeout for test environments)
        try {
            await Promise.race([
                _deps.appInit?.waitForCore(),
                new Promise((resolve) => setTimeout(resolve, 1000)) // 1s timeout for tests
            ]);
            console.log('✅ Task core system initialized successfully');
        } catch (error) {
            console.warn('⚠️ Task core system initialization failed:', error);
            ui()?.showNotification?.('Task system initialized with limited functionality', 'warning');
        }
    }

    // ============================================================================
    // FALLBACK METHODS
    // ============================================================================

    /**
     * Wait for core with timeout (for test environment compatibility)
     */
    async waitForCoreWithTimeout() {
        try {
            await Promise.race([
                _deps.appInit?.waitForCore(),
                new Promise((resolve) => setTimeout(resolve, 100)) // 100ms timeout for tests
            ]);
        } catch (error) {
            console.warn('⚠️ Core wait timeout or error:', error);
        }
    }

    /**
     * Wait for specific global functions to be available
     * Used by resetTasks to ensure UI functions exist before calling them
     *
     * Note: Dependencies may be passed as getter functions (e.g., () => window.helpWindowManager)
     * to handle late initialization. This method resolves getters before checking.
     */
    async waitForUIFunctions(maxWaitMs = 2000) {
        const startTime = Date.now();
        const checkInterval = 50; // Check every 50ms

        // Helper to resolve getter functions
        const resolveGetter = (dep) => {
            if (typeof dep === 'function' && dep.length === 0) {
                // It's a getter function (no args), call it to get the actual value
                try {
                    return dep();
                } catch {
                    return null;
                }
            }
            return dep;
        };

        while (Date.now() - startTime < maxWaitMs) {
            // Check injected deps only (DI-pure, no window.* fallback)
            // Resolve getters for deps that may be late-initialized
            const hasIncrementCycleCount = typeof this.deps.incrementCycleCount === 'function';
            const helpWindowMgr = resolveGetter(this.deps.helpWindowManager);
            const hasHelpWindowManager = helpWindowMgr && typeof helpWindowMgr.showCycleCompleteMessage === 'function';
            const hasShowCompletionAnimation = typeof this.deps.showCompletionAnimation === 'function';

            if (hasIncrementCycleCount && hasHelpWindowManager && hasShowCompletionAnimation) {
                console.log('✅ All UI functions available for resetTasks');
                return true;
            }

            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        // Final check for logging
        const helpWindowMgr = resolveGetter(this.deps.helpWindowManager);
        console.warn('⚠️ Timeout waiting for UI functions:', {
            incrementCycleCount: typeof this.deps.incrementCycleCount === 'function',
            helpWindowManager: helpWindowMgr && typeof helpWindowMgr.showCycleCompleteMessage === 'function',
            showCompletionAnimation: typeof this.deps.showCompletionAnimation === 'function'
        });
        return false;
    }

    fallbackNotification(message, type = 'info') {
        console.log(`[TaskCore] ${message}`);
    }

    fallbackLoadData() {
        console.warn('⚠️ loadMiniCycleData not available');
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

    // ============================================================================
    // ✅ FIX #7: TIMEOUT MANAGEMENT
    // ============================================================================

    /**
     * Track a timeout for later cleanup
     * @param {number} timeoutId - The timeout ID returned by setTimeout
     */
    trackTimeout(timeoutId) {
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Clear a specific timeout and remove from tracking
     * @param {number} timeoutId - The timeout ID to clear
     */
    clearTrackedTimeout(timeoutId) {
        clearTimeout(timeoutId);
        this.activeTimeouts.delete(timeoutId);
    }

    /**
     * Clear all tracked timeouts (called on cleanup/destroy)
     */
    clearAllTimeouts() {
        console.log(`🧹 Clearing ${this.activeTimeouts.size} active timeouts`);
        for (const timeoutId of this.activeTimeouts) {
            clearTimeout(timeoutId);
        }
        this.activeTimeouts.clear();
    }

    // ============================================================================
    // TASK CRUD OPERATIONS
    // ============================================================================

    /**
     * Add a new task to the current cycle
     * @param {string} taskText - The text content of the task
     * @param {boolean} completed - Whether the task is completed
     * @param {boolean} shouldSave - Whether to save immediately
     * @param {string|null} dueDate - Due date for the task
     * @param {boolean|null} highPriority - Whether task is high priority
     * @param {boolean} isLoading - Whether task is being loaded from storage
     * @param {boolean} remindersEnabled - Whether reminders are enabled for this task
     * @param {boolean} recurring - Whether task is recurring
     * @param {string|null} taskId - Specific task ID (for loading)
     * @param {object} recurringSettings - Settings for recurring tasks
     */
    async addTask(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}, deleteWhenComplete = undefined, deleteWhenCompleteSettings = undefined, deferAppend = false, targetContainer = null) {
        try {
            // Wait for core to be ready
            await this.waitForCoreWithTimeout();

            // Validate AppState is available
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready, task creation may fail');
            }

            // Input validation and sanitization
            const validatedInput = this.deps.validateAndSanitizeTaskInput?.(taskText);
            if (!validatedInput) {
                console.warn('⚠️ Task validation failed');
                return;
            }

            // Load and validate data context
            const taskContext = this.deps.loadTaskContext?.(validatedInput, taskId, {
                completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings, deleteWhenComplete, deleteWhenCompleteSettings
            }, isLoading);
            if (!taskContext) {
                console.warn('⚠️ Could not load task context');
                return;
            }

            // Create or update task data
            const taskData = this.deps.createOrUpdateTaskData?.(taskContext);

            // Create DOM elements
            const taskElements = this.deps.createTaskDOMElements?.(taskContext, taskData);

            // Setup task interactions and events
            this.deps.setupTaskInteractions?.(taskElements, taskContext);

            // Finalize task creation (✅ FIX #6: Pass batch options)
            const result = this.deps.finalizeTaskCreation?.(taskElements, taskContext, {
                shouldSave,
                isLoading,
                deferAppend,
                targetContainer
            });

            console.log('✅ Task creation completed (Schema 2.5)');

            return result; // ✅ FIX #6: Return taskItem for batch processing

        } catch (error) {
            console.warn('⚠️ Task creation failed:', error);
            ui()?.showNotification?.('Could not add task - please try again', 'warning');
        }
    }

    /**
     * Edit an existing task's text
     * @param {HTMLElement} taskItem - The task DOM element
     */
    async editTask(taskItem) {
        try {
            await this.waitForCoreWithTimeout();

            const taskLabel = taskItem.querySelector("span");
            const oldText = taskLabel.textContent.trim();

            this.deps.showPromptModal({
                title: "Edit Task Name",
                message: "Rename this task:",
                placeholder: "Enter new task name",
                defaultValue: oldText,
                confirmText: "Save",
                cancelText: "Cancel",
                required: true,
                callback: async (newText) => {
                    if (newText && newText.trim() !== oldText) {
                        const cleanText = this.deps.sanitizeInput(newText.trim());

                        // Enable undo system
                        this.deps.enableUndoSystemOnFirstInteraction();

                        // Capture snapshot BEFORE changing text
                        if (this.deps.AppState?.isReady?.()) {
                            const currentState = this.deps.AppState.get();
                            if (currentState) this.deps.captureStateSnapshot(currentState);
                        }

                        // Update DOM
                        taskLabel.textContent = cleanText;

                        const taskId = taskItem.dataset.taskId;

                        // Update AppState
                        if (this.deps.AppState?.isReady?.()) {
                            await this.deps.AppState.update(state => {
                                const cid = state.appState.activeCycleId;
                                const cycle = state.data.cycles[cid];
                                const t = cycle?.tasks?.find(t => t.id === taskId);
                                if (t) t.text = cleanText;
                            }, true);
                        } else {
                            // Fallback to localStorage
                            const schemaData = this.deps.loadMiniCycleData();
                            if (schemaData) {
                                const cycles = schemaData.data?.cycles || {};
                                const activeCycle = schemaData.appState?.activeCycleId;
                                const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
                                if (task) {
                                    task.text = cleanText;
                                    const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                                    if (fullSchemaData) {
                                        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
                                        fullSchemaData.metadata.lastModified = Date.now();
                                        this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
                                    }
                                }
                            }
                        }

                        ui()?.showNotification?.(`Task renamed to "${cleanText}"`, "info", 1500);
                        this.deps.updateStatsPanel();
                        this.deps.updateProgressBar();
                        this.deps.checkCompleteAllButton();
                    }
                }
            });

        } catch (error) {
            console.warn('⚠️ Task edit failed:', error);
            ui()?.showNotification?.('Could not edit task', 'warning');
        }
    }

    /**
     * Delete a task with confirmation
     * @param {HTMLElement} taskItem - The task DOM element
     */
    async deleteTask(taskItem) {
        try {
            await this.waitForCoreWithTimeout();

            const taskId = taskItem.dataset.taskId;
            const taskName = taskItem.querySelector(".task-text")?.textContent || "Task";

            this.deps.showConfirmationModal({
                title: "Delete Task",
                message: `Are you sure you want to delete "${taskName}"?`,
                confirmText: "Delete",
                cancelText: "Cancel",
                callback: async (confirmDelete) => {
                    if (!confirmDelete) {
                        ui()?.showNotification?.(`"${taskName}" has not been deleted.`, "show", 2500);
                        return;
                    }

                    // Enable undo system
                    this.deps.enableUndoSystemOnFirstInteraction();

                    // Capture snapshot BEFORE deletion
                    if (this.deps.AppState?.isReady?.()) {
                        const currentState = this.deps.AppState.get();
                        if (currentState) this.deps.captureStateSnapshot(currentState);
                    }

                    // Update AppState
                    if (this.deps.AppState?.isReady?.()) {
                        await this.deps.AppState.update(state => {
                            const cid = state.appState.activeCycleId;
                            const cycle = state.data.cycles[cid];
                            if (cycle?.tasks) {
                                const index = cycle.tasks.findIndex(t => t.id === taskId);
                                if (index !== -1) {
                                    cycle.tasks.splice(index, 1);
                                }
                            }
                        }, true);

                        // Remove from DOM
                        taskItem.remove();

                        ui()?.showNotification?.(`Task "${taskName}" deleted.`, "show", 2500);
                        this.deps.updateStatsPanel();
                        this.deps.updateProgressBar();
                        this.deps.checkCompleteAllButton();

                        // Update move arrows (first/last task may have changed)
                        if (typeof this.deps.updateMoveArrowsVisibility === 'function') {
                            this.deps.updateMoveArrowsVisibility();
                        }

                    } else {
                        // Fallback to localStorage
                        const schemaData = this.deps.loadMiniCycleData();
                        if (schemaData) {
                            const cycles = schemaData.data?.cycles || {};
                            const activeCycle = schemaData.appState?.activeCycleId;
                            const tasks = cycles[activeCycle]?.tasks || [];
                            const index = tasks.findIndex(t => t.id === taskId);

                            if (index !== -1) {
                                tasks.splice(index, 1);
                                const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                                if (fullSchemaData) {
                                    fullSchemaData.data.cycles[activeCycle].tasks = tasks;
                                    fullSchemaData.metadata.lastModified = Date.now();
                                    this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));

                                    taskItem.remove();
                                    ui()?.showNotification?.(`Task "${taskName}" deleted.`, "show", 2500);
                                    this.deps.updateStatsPanel();
                                    this.deps.updateProgressBar();
                                    this.deps.checkCompleteAllButton();

                                    // Update move arrows (first/last task may have changed)
                                    if (typeof this.deps.updateMoveArrowsVisibility === 'function') {
                                        this.deps.updateMoveArrowsVisibility();
                                    }
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.warn('⚠️ Task deletion failed:', error);
            ui()?.showNotification?.('Could not delete task', 'warning');
        }
    }

    /**
     * Toggle task priority (high/normal)
     * @param {HTMLElement} taskItem - The task DOM element
     */
    async toggleTaskPriority(taskItem) {
        try {
            await this.waitForCoreWithTimeout();

            // Enable undo system
            this.deps.enableUndoSystemOnFirstInteraction();

            const taskId = taskItem.dataset.taskId;

            // Read fresh state from AppState
            const currentState = this.deps.AppState?.get();
            if (!currentState) {
                console.error('❌ AppState not available for priority toggle');
                return;
            }

            const activeCycleId = currentState.appState?.activeCycleId;
            const freshCycle = currentState.data?.cycles?.[activeCycleId];
            const task = freshCycle?.tasks?.find(t => t.id === taskId);

            if (!task) {
                console.warn('⚠️ Task not found for priority toggle:', taskId);
                return;
            }

            // Toggle based on AppState, not DOM
            const isCurrentlyHighPriority = task.highPriority === true;
            const newHighPriority = !isCurrentlyHighPriority;

            console.log('⭐ Toggling priority state:', {
                taskId: taskId,
                wasHighPriority: isCurrentlyHighPriority,
                willBeHighPriority: newHighPriority
            });

            // Capture snapshot BEFORE changing priority
            if (this.deps.AppState?.isReady?.()) {
                this.deps.captureStateSnapshot(currentState);
            }

            // Update DOM based on calculated state
            taskItem.classList.toggle("high-priority", newHighPriority);
            const button = taskItem.querySelector(".priority-btn");
            if (button) {
                button.classList.toggle("active", newHighPriority);
                button.classList.toggle("priority-active", newHighPriority);
                button.setAttribute("aria-pressed", newHighPriority.toString());
            }

            // Update AppState
            if (this.deps.AppState?.isReady?.()) {
                this.deps.AppState.update(state => {
                    const cid = state.appState.activeCycleId;
                    const cycle = state.data.cycles[cid];
                    const t = cycle?.tasks?.find(t => t.id === taskId);
                    if (t) t.highPriority = newHighPriority;
                }, true);

                ui()?.showNotification?.(
                    `Priority ${newHighPriority ? "enabled" : "removed"}.`,
                    newHighPriority ? "error" : "info",
                    1500
                );
            } else {
                // Fallback to localStorage
                const schemaData = this.deps.loadMiniCycleData();
                if (schemaData) {
                    const cycles = schemaData.data?.cycles || {};
                    const activeCycle = schemaData.appState?.activeCycleId;
                    const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
                    if (task) {
                        task.highPriority = taskItem.classList.contains("high-priority");
                        const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                        if (fullSchemaData) {
                            fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
                            fullSchemaData.metadata.lastModified = Date.now();
                            this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
                            ui()?.showNotification?.(
                                `Priority ${task.highPriority ? "enabled" : "removed"}.`,
                                task.highPriority ? "error" : "info",
                                1500
                            );
                        }
                    }
                }
            }

        } catch (error) {
            console.warn('⚠️ Priority toggle failed:', error);
            ui()?.showNotification?.('Could not toggle priority', 'warning');
        }
    }

    // ============================================================================
    // TASK COMPLETION & STATE MANAGEMENT
    // ============================================================================

    /**
     * Handle task completion checkbox change
     * @param {HTMLInputElement} checkbox - The checkbox element
     */
    async handleTaskCompletionChange(checkbox) {
        try {
            const taskItem = checkbox.closest(".task");
            const taskId = taskItem?.dataset?.taskId;
            const isCompleted = checkbox.checked;

            // ✅ Capture state snapshot BEFORE making changes (for undo)
            if (typeof this.deps.captureStateSnapshot === 'function' && !this.deps.isPerformingUndoRedo()) {
                const currentState = this.deps.AppState?.get?.();
                if (currentState) {
                    this.deps.captureStateSnapshot(currentState);
                    console.log('📸 Captured snapshot before task completion change');
                }
            }

            // ✅ UPDATE: Save completion state to AppState/localStorage (only if taskId exists)
            if (taskId) {
                // Update AppState if available
                if (this.deps.AppState?.isReady?.()) {
                    await this.deps.AppState.update(state => {
                        const cid = state.appState?.activeCycleId;
                        const cycle = state.data?.cycles?.[cid];
                        if (!cycle?.tasks) return;

                        const task = cycle.tasks.find(t => t.id === taskId);
                        if (task) {
                            task.completed = isCompleted;
                            console.log(`✅ Task completion saved to AppState: ${task.text} = ${isCompleted}`);
                        }
                    }, false); // Don't force immediate save, let debounce handle it
                } else {
                    // Fallback to localStorage
                    const schemaData = this.deps.loadMiniCycleData();
                    if (schemaData) {
                        const activeCycle = schemaData.appState?.activeCycleId;
                        const task = schemaData.data?.cycles?.[activeCycle]?.tasks?.find(t => t.id === taskId);
                        if (task) {
                            task.completed = isCompleted;

                            // Save to localStorage
                            const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                            if (fullSchemaData?.data?.cycles?.[activeCycle]) {
                                const taskIndex = fullSchemaData.data.cycles[activeCycle].tasks.findIndex(t => t.id === taskId);
                                if (taskIndex !== -1) {
                                    fullSchemaData.data.cycles[activeCycle].tasks[taskIndex].completed = isCompleted;
                                    fullSchemaData.metadata.lastModified = Date.now();
                                    this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
                                    console.log(`✅ Task completion saved to localStorage: ${task.text} = ${isCompleted}`);
                                }
                            }
                        }
                    }
                }
            } else {
                console.warn('⚠️ No task ID found - completion state not saved (DOM update only)');
            }

            // Update DOM classes (always do this, even without taskId for test compatibility)
            if (taskItem) {
                if (isCompleted) {
                    taskItem.classList.remove("overdue-task");
                } else {
                    // Check if task is overdue
                    if (typeof this.deps.checkOverdueTasks === 'function') {
                        this.deps.checkOverdueTasks(taskItem);
                    }
                }

                // Move task between active and completed lists
                if (typeof this.deps.handleTaskListMovement === 'function') {
                    this.deps.handleTaskListMovement(taskItem, isCompleted);
                }
            }

            // Update help window if available (DI-pure, no window.* fallback)
            // Note: helpWindowManager may be a getter function
            const helpWindowMgr = this._resolveGetter(this.deps.helpWindowManager);
            if (helpWindowMgr && typeof helpWindowMgr.updateConstantMessage === 'function') {
                setTimeout(() => {
                    helpWindowMgr.updateConstantMessage();
                }, 100);
            }
        } catch (error) {
            console.warn('⚠️ Task completion change failed:', error);
        }
    }

    /**
     * Save current task order after drag & drop
     */
    async saveCurrentTaskOrder() {
        try {
            await this.waitForCoreWithTimeout();

            const taskElements = this.deps.querySelectorAll("#taskList .task");
            const newOrderIds = Array.from(taskElements).map(task => task.dataset.taskId);

            // Use AppState to trigger undo snapshots
            if (this.deps.AppState?.isReady?.()) {
                await this.deps.AppState.update(state => {
                    const cid = state.appState.activeCycleId;
                    const cycle = state.data.cycles[cid];
                    if (!cycle?.tasks) return;

                    // Reorder tasks based on DOM order
                    const reorderedTasks = newOrderIds.map(id =>
                        cycle.tasks.find(task => task.id === id)
                    ).filter(Boolean);

                    cycle.tasks = reorderedTasks;
                }, true);
                return;
            }

            // Fallback to localStorage
            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Schema 2.5 data required for saveCurrentTaskOrder');
                return;
            }
            const cycles = schemaData.data?.cycles || {};
            const activeCycle = schemaData.appState?.activeCycleId;
            const currentCycle = cycles[activeCycle];
            if (!currentCycle || !Array.isArray(currentCycle.tasks)) return;

            const reorderedTasks = newOrderIds.map(id =>
                currentCycle.tasks.find(task => task.id === id)
            ).filter(Boolean);

            currentCycle.tasks = reorderedTasks;

            const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
            if (fullSchemaData) {
                fullSchemaData.data.cycles[activeCycle] = currentCycle;
                fullSchemaData.metadata.lastModified = Date.now();
                this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
            }

        } catch (error) {
            console.warn('⚠️ Save task order failed:', error);
        }
    }

    /**
     * Save task data to Schema 2.5 storage
     * Prioritizes AppState, falls back to localStorage
     *
     * @param {string} activeCycle - The cycle ID to save
     * @param {object} currentCycle - The cycle data to save
     */
    saveTaskToSchema25(activeCycle, currentCycle) {
        // Use AppState if available, otherwise fallback to localStorage
        if (this.deps.AppState && this.deps.AppState.isReady()) {
            try {
                this.deps.AppState.update(state => {
                    if (state && state.data && state.data.cycles) {
                        state.data.cycles[activeCycle] = currentCycle;
                        state.metadata.lastModified = Date.now();
                    }
                });
                return;
            } catch (error) {
                console.warn('⚠️ AppState save failed, falling back to localStorage:', error);
                // Fall through to localStorage fallback
            }
        }

        // Fallback to localStorage if AppState not ready or failed
        try {
            const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
            if (fullSchemaData && fullSchemaData.data && fullSchemaData.data.cycles) {
                fullSchemaData.data.cycles[activeCycle] = currentCycle;
                fullSchemaData.metadata.lastModified = Date.now();
                this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
            } else {
                console.error('❌ Invalid schema data structure in localStorage');
            }
        } catch (error) {
            console.error('❌ Failed to save to localStorage:', error);
        }
    }

    /**
     * Reset all tasks (cycle completion)
     */
    async resetTasks() {
        try {
            if (this.isResetting) return;
            this.isResetting = true;

            console.log('🔄 Resetting tasks (Schema 2.5 only)...');

            // Wait for critical UI functions to be available
            console.log('⏳ Waiting for UI functions (helpWindowManager, incrementCycleCount, etc.)...');
            await this.waitForUIFunctions();

            let cycles, activeCycle, cycleData;
            const taskList = this.deps.querySelector("#taskList");
            const completedTaskList = this.deps.querySelector("#completedTaskList");

            // ✅ FIX: Get tasks from BOTH active and completed lists
            let taskElements = [];
            if (taskList) {
                taskElements.push(...taskList.querySelectorAll(".task"));
            }
            if (completedTaskList) {
                taskElements.push(...completedTaskList.querySelectorAll(".task"));
            }

            const progressBar = this.deps.querySelector("#progressBar");

            // Validate DOM elements
            if (!taskList) {
                console.error('❌ Task list element not found');
                this.isResetting = false;
                return;
            }

            // Try AppState first, fall back to localStorage
            if (this.deps.AppState?.isReady?.()) {
                const state = this.deps.AppState.get();
                cycles = state?.data?.cycles || {};
                activeCycle = state?.appState?.activeCycleId;
                cycleData = cycles[activeCycle];
            } else {
                // Fallback to localStorage
                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for resetTasks');
                    this.isResetting = false;
                    throw new Error('Schema 2.5 data not found');
                }
                cycles = schemaData.data?.cycles || {};
                activeCycle = schemaData.appState?.activeCycleId;
                cycleData = cycles[activeCycle];
            }

            if (!activeCycle || !cycleData) {
                console.error("❌ No active cycle found in Schema 2.5 for resetTasks");
                this.isResetting = false;
                return;
            }

            console.log('📊 Resetting tasks for cycle:', activeCycle);

            // ✅ CAPTURE UNDO SNAPSHOT BEFORE ANY MODIFICATIONS
            if (typeof this.deps.captureStateSnapshot === 'function' && !this.deps.isPerformingUndoRedo()) {
                const currentState = this.deps.AppState?.get?.();
                if (currentState) {
                    this.deps.captureStateSnapshot(currentState);
                    console.log('📸 Undo snapshot captured BEFORE task reset (includes current cycle count and task states)');
                }
            }

            // Animation: Show progress bar becoming full first
            if (progressBar) {
                progressBar.style.transform = "scaleX(1)";
                progressBar.style.transition = "transform 0.2s ease-out";
            }

            // Wait for animation, then reset tasks
            setTimeout(() => {
                console.log('🧹 Removing recurring tasks and resetting non-recurring tasks');

                // Remove recurring tasks
                if (typeof this.deps.removeRecurringTasksFromCycle === 'function') {
                    this.deps.removeRecurringTasksFromCycle(taskElements, cycleData);
                }

                // ✅ Update task data AND DOM for non-recurring tasks
                const tasksToDelete = [];
                taskElements.forEach(taskEl => {
                    const isRecurring = taskEl.classList.contains("recurring");
                    if (isRecurring) return;

                    const taskId = taskEl.dataset.taskId;
                    const task = cycleData?.tasks?.find(t => t.id === taskId);

                    // ✅ Check if task should be deleted on reset
                    if (task?.deleteWhenComplete === true) {
                        console.log(`🗑️ Marking task for deletion (deleteWhenComplete): ${task.text}`);
                        tasksToDelete.push(taskId);
                        taskEl.remove(); // Remove from DOM
                        return;
                    }

                    // Otherwise, reset the task normally
                    const checkbox = taskEl.querySelector("input[type='checkbox']");
                    const dueDateInput = taskEl.querySelector(".due-date");

                    // Update DOM
                    if (checkbox) checkbox.checked = false;
                    taskEl.classList.remove("overdue-task");

                    if (dueDateInput) {
                        dueDateInput.value = "";
                        dueDateInput.classList.add("hidden");
                    }

                    // ✅ FIX: Update the actual task data in memory
                    if (task) {
                        task.completed = false;
                        task.dueDate = null;
                        console.log(`✅ Reset task data for: ${task.text}`);
                    }
                });

                // ✅ Remove tasks marked for deletion from cycle data
                if (tasksToDelete.length > 0) {
                    cycleData.tasks = cycleData.tasks.filter(t => !tasksToDelete.includes(t.id));
                    console.log(`🗑️ Deleted ${tasksToDelete.length} task(s) with deleteWhenComplete=true`);
                }

                // ✅ FIX: Save the updated task data to AppState (will auto-save to localStorage after 600ms debounce)
                if (this.deps.AppState?.isReady?.()) {
                    this.deps.AppState.update(state => {
                        if (state?.data?.cycles?.[activeCycle]) {
                            state.data.cycles[activeCycle] = cycleData;
                        }
                    });
                    console.log('✅ Reset task data saved to AppState (will persist to localStorage)');
                } else {
                    // Fallback: Save directly to localStorage if AppState not available
                    const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                    if (fullSchemaData?.data?.cycles?.[activeCycle]) {
                        fullSchemaData.data.cycles[activeCycle] = cycleData;
                        fullSchemaData.metadata.lastModified = Date.now();
                        this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
                        console.log('✅ Reset task data saved to localStorage (AppState fallback)');
                    }
                }

                // ✅ FIX: Move completed tasks back to active list after reset
                if (completedTaskList && taskList) {
                    const completedTaskElements = completedTaskList.querySelectorAll('.task');
                    completedTaskElements.forEach(taskEl => {
                        // Only move non-recurring tasks (recurring tasks are already removed)
                        if (!taskEl.classList.contains('recurring')) {
                            taskList.appendChild(taskEl);
                        }
                    });
                    if (completedTaskElements.length > 0) {
                        console.log(`✅ Moved ${completedTaskElements.length} task(s) from completed list back to active list`);
                    }

                    // Update completed tasks count
                    if (typeof this.deps.updateCompletedTasksCount === 'function') {
                        this.deps.updateCompletedTasksCount();
                    }
                }

                // Increment cycle count (this calls showCompletionAnimation internally)
                // DI-pure: use injected dep only
                if (typeof this.deps.incrementCycleCount === 'function') {
                    this.deps.incrementCycleCount(activeCycle, cycles);
                }

                // Animate progress bar reset
                if (progressBar) {
                    progressBar.style.transition = "transform 0.3s ease-in";
                    progressBar.style.transform = "scaleX(0)";

                    setTimeout(() => {
                        progressBar.style.transition = "";
                    }, 50);
                }

                // Show cycle completion message (DI-pure, no window.* fallback)
                // Note: helpWindowManager may be a getter function
                const helpWindowMgr = this._resolveGetter(this.deps.helpWindowManager);
                if (helpWindowMgr?.showCycleCompleteMessage) {
                    helpWindowMgr.showCycleCompleteMessage();
                }

                // ✅ Update undo/redo buttons to reflect the new snapshot
                if (typeof this.deps.updateUndoRedoButtons === 'function') {
                    this.deps.updateUndoRedoButtons();
                    console.log('✅ Undo/redo buttons updated after cycle completion');
                }

                console.log('✅ Task reset animation completed');

            }, 100);

            // Release reset lock
            setTimeout(() => {
                this.isResetting = false;
                console.log('🔓 Reset lock released');
            }, 2000);

            // Post-reset cleanup
            setTimeout(() => {
                console.log('🔄 Running post-reset cleanup tasks');
                if (this.deps.recurringCore?.watchRecurringTasks) {
                    this.deps.recurringCore.watchRecurringTasks();
                }
                state()?.autoSave?.();
                this.deps.updateStatsPanel();
                console.log('✅ Reset tasks completed successfully');
            }, 1000);

        } catch (error) {
            console.warn('⚠️ Reset tasks failed:', error);
            this.isResetting = false;
            ui()?.showNotification?.('Could not reset tasks', 'warning');
        }
    }

    /**
     * Complete all tasks at once
     */
    async handleCompleteAllTasks() {
        try {
            console.log('✔️ Handling complete all tasks (Schema 2.5 only)...');

            let cycles, activeCycle, cycleData;
            const taskList = this.deps.querySelector("#taskList");

            // Try AppState first, fall back to localStorage
            if (this.deps.AppState?.isReady?.()) {
                const state = this.deps.AppState.get();
                cycles = state?.data?.cycles || {};
                activeCycle = state?.appState?.activeCycleId;
                cycleData = cycles[activeCycle];
            } else {
                // Fallback to localStorage
                const schemaData = this.deps.loadMiniCycleData();
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for handleCompleteAllTasks');
                    throw new Error('Schema 2.5 data not found');
                }
                cycles = schemaData.data?.cycles || {};
                activeCycle = schemaData.appState?.activeCycleId;
                cycleData = cycles[activeCycle];
            }

            if (!activeCycle || !cycleData) {
                console.warn('⚠️ No active cycle found for complete all tasks');
                return;
            }

            console.log('📊 Processing complete all tasks for cycle:', activeCycle);

            // Only show alert if tasks will be reset (not deleted)
            if (!cycleData.deleteCheckedTasks) {
                const hasDueDates = [...taskList.querySelectorAll(".due-date")].some(
                    dueDateInput => dueDateInput.value
                );

                if (hasDueDates) {
                    this.deps.showConfirmationModal({
                        title: "Reset Tasks with Due Dates",
                        message: "⚠️ This will complete all tasks and reset them to an uncompleted state.<br><br>Any assigned Due Dates will be cleared.<br><br>Proceed?",
                        confirmText: "Reset Tasks",
                        cancelText: "Cancel",
                        callback: (confirmed) => {
                            if (!confirmed) return;

                            if (cycleData.deleteCheckedTasks) {
                                // ✅ To-Do mode: Delete completed tasks that have deleteWhenComplete enabled
                                const tasksToDelete = [];
                                const allTaskElements = taskList.querySelectorAll(".task");

                                allTaskElements.forEach(taskElement => {
                                    const taskId = taskElement.dataset.taskId;
                                    const task = cycleData.tasks?.find(t => t.id === taskId);
                                    const checkbox = taskElement.querySelector("input[type='checkbox']");
                                    const isCompleted = checkbox?.checked || false;

                                    // Delete only if task is completed AND deleteWhenComplete is true
                                    if (isCompleted && task?.deleteWhenComplete === true) {
                                        tasksToDelete.push({ taskId, taskElement });
                                    }
                                });

                                if (tasksToDelete.length === 0) {
                                    ui()?.showNotification?.("⚠️ No completed tasks to delete.", "default", 3000);
                                    return;
                                }

                                // Remove from DOM and data
                                tasksToDelete.forEach(({ taskId, taskElement }) => {
                                    cycleData.tasks = cycleData.tasks.filter(t => t.id !== taskId);
                                    taskElement.remove();
                                });

                                state()?.autoSave?.();

                                // ✅ Update progress bar after bulk deletion in confirmation modal
                                this.deps.updateProgressBar();
                                this.deps.updateStatsPanel();
                                this.deps.checkCompleteAllButton();

                            } else {
                                taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                                if (typeof this.deps.checkMiniCycle === 'function') {
                                    this.deps.checkMiniCycle();
                                }

                                if (!cycleData.autoReset) {
                                    setTimeout(() => this.resetTasks(), 1000);
                                }
                            }
                        }
                    });
                    return;
                }
            }

            if (cycleData.deleteCheckedTasks) {
                // ✅ To-Do mode: Delete completed tasks that have deleteWhenComplete enabled
                console.log('🗑️ To-Do mode: Deleting completed tasks marked for deletion');

                // Find all tasks that are BOTH completed AND marked for deletion
                const tasksToDelete = [];
                const allTaskElements = taskList.querySelectorAll(".task");

                allTaskElements.forEach(taskElement => {
                    const taskId = taskElement.dataset.taskId;
                    const task = cycleData.tasks?.find(t => t.id === taskId);
                    const checkbox = taskElement.querySelector("input[type='checkbox']");
                    const isCompleted = checkbox?.checked || false;

                    // Delete only if task is completed AND deleteWhenComplete is true
                    if (isCompleted && task?.deleteWhenComplete === true) {
                        tasksToDelete.push({ taskId, taskElement });
                    }
                });

                if (tasksToDelete.length === 0) {
                    ui()?.showNotification?.("⚠️ No completed tasks to delete.", "default", 3000);
                    return;
                }

                console.log(`🗑️ Deleting ${tasksToDelete.length} tasks marked for deletion (deleteWhenComplete=true)`);

                // Remove from DOM
                const taskIdsToDelete = tasksToDelete.map(({ taskId, taskElement }) => {
                    taskElement.remove();
                    return taskId;
                });

                // Update data (AppState or localStorage)
                if (this.deps.AppState?.isReady?.()) {
                    await this.deps.AppState.update(state => {
                        const cid = state.appState.activeCycleId;
                        const cycle = state.data.cycles[cid];
                        if (cycle?.tasks) {
                            cycle.tasks = cycle.tasks.filter(t => !taskIdsToDelete.includes(t.id));
                            console.log(`✅ Removed ${taskIdsToDelete.length} tasks from state`);
                        }
                    }, true);
                } else {
                    // Fallback to localStorage
                    cycleData.tasks = cycleData.tasks.filter(t => !taskIdsToDelete.includes(t.id));
                    const fullSchemaData = this.deps.safeJSONParse(this.deps.safeLocalStorageGet("miniCycleData", null), null);
                    if (fullSchemaData) {
                        fullSchemaData.data.cycles[activeCycle] = cycleData;
                        fullSchemaData.metadata.lastModified = Date.now();
                        this.deps.safeLocalStorageSet("miniCycleData", this.deps.safeJSONStringify(fullSchemaData, null));
                    }
                }

                // ✅ Update progress bar after bulk deletion
                this.deps.updateProgressBar();
                this.deps.updateStatsPanel();
                this.deps.checkCompleteAllButton();

            } else {
                console.log('✔️ Marking all tasks as complete');

                taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                if (typeof this.deps.checkMiniCycle === 'function') {
                    this.deps.checkMiniCycle();
                }

                // Only call resetTasks() if autoReset is OFF
                if (!cycleData.autoReset) {
                    setTimeout(() => this.resetTasks(), 1000);
                }
            }

            console.log('✅ Complete all tasks handled (Schema 2.5)');

        } catch (error) {
            console.warn('⚠️ Complete all tasks failed:', error);
            ui()?.showNotification?.('Could not complete all tasks', 'warning');
        }
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

            // Phase 3 - No window.* exports (main script handles exposure)
            console.log('✅ TaskCore initialized (Phase 3)');
        } catch (e) {
            // ✅ FIX #5: Error boundary for TaskCore initialization
            console.error('❌ TaskCore initialization failed:', e);

            // Clean up partial initialization
            taskCoreInstance = null;

            // Notify user if notification system is available
            if (dependencies.showNotification) {
                dependencies.showNotification('⚠️ Task system failed to initialize', 'error', 5000);
            }

            throw e; // Re-throw so caller knows initialization failed
        }
    }
    return taskCoreInstance;
}

// ============================================================================
// WRAPPER FUNCTIONS (for cross-module compatibility)
// ============================================================================

function addTask(...args) {
    if (!taskCoreInstance) {
        console.warn('⚠️ TaskCore not initialized');
        return Promise.reject(new Error('TaskCore not initialized'));
    }
    return taskCoreInstance.addTask(...args);
}

function editTaskFromCore(taskItem) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.editTask(taskItem);
}

function deleteTaskFromCore(taskItem) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.deleteTask(taskItem);
}

function toggleTaskPriorityFromCore(taskItem) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.toggleTaskPriority(taskItem);
}

function handleTaskCompletionChange(checkbox) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.handleTaskCompletionChange(checkbox);
}

function saveCurrentTaskOrder() {
    if (!taskCoreInstance) return;
    return taskCoreInstance.saveCurrentTaskOrder();
}

function saveTaskToSchema25(cycleId, cycleData) {
    if (!taskCoreInstance) return;
    return taskCoreInstance.saveTaskToSchema25(cycleId, cycleData);
}

function resetTasks() {
    if (!taskCoreInstance) return;
    return taskCoreInstance.resetTasks();
}

function handleCompleteAllTasks() {
    if (!taskCoreInstance) return;
    return taskCoreInstance.handleCompleteAllTasks();
}

// ============================================================================
// EXPORTS
// ============================================================================

// Phase 3 - Clean exports (no new window.* globals; legacy reads only)
console.log('🎯 TaskCore module loaded (Phase 3 - DI-pure)');

export {
    // TaskCore class already exported at line 21
    taskCoreInstance,
    addTask,
    editTaskFromCore,
    deleteTaskFromCore,
    toggleTaskPriorityFromCore,
    handleTaskCompletionChange,
    saveCurrentTaskOrder,
    saveTaskToSchema25,
    resetTasks,
    handleCompleteAllTasks
};
