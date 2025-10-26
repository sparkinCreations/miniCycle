/**
 * 🎯 miniCycle Task Core Module
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
 * @version 1.305
 */

import { appInit } from '../appInitialization.js';

export class TaskCore {
    constructor(dependencies = {}) {
        this.version = '1.305';

        // Store dependencies with intelligent fallbacks
        this.deps = {
            // State management
            AppState: dependencies.AppState || null,

            // Data operations
            loadMiniCycleData: dependencies.loadMiniCycleData || this.fallbackLoadData,
            sanitizeInput: dependencies.sanitizeInput || ((text) => text),

            // UI updates
            showNotification: dependencies.showNotification || this.fallbackNotification,
            updateStatsPanel: dependencies.updateStatsPanel || (() => console.log('⏭️ updateStatsPanel not available')),
            updateProgressBar: dependencies.updateProgressBar || (() => console.log('⏭️ updateProgressBar not available')),
            checkCompleteAllButton: dependencies.checkCompleteAllButton || (() => console.log('⏭️ checkCompleteAllButton not available')),
            refreshUIFromState: dependencies.refreshUIFromState || (() => console.log('⏭️ refreshUIFromState not available')),

            // Undo system
            captureStateSnapshot: dependencies.captureStateSnapshot || (() => console.log('⏭️ captureStateSnapshot not available')),
            enableUndoSystemOnFirstInteraction: dependencies.enableUndoSystemOnFirstInteraction || (() => {}),

            // Modal system
            showPromptModal: dependencies.showPromptModal || this.fallbackPromptModal,
            showConfirmationModal: dependencies.showConfirmationModal || this.fallbackConfirmModal,

            // DOM helpers
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((selector) => document.querySelector(selector)),
            querySelectorAll: dependencies.querySelectorAll || ((selector) => document.querySelectorAll(selector)),

            // Task DOM creation (will be injected from taskDOM.js later)
            validateAndSanitizeTaskInput: dependencies.validateAndSanitizeTaskInput || null,
            loadTaskContext: dependencies.loadTaskContext || null,
            createOrUpdateTaskData: dependencies.createOrUpdateTaskData || null,
            createTaskDOMElements: dependencies.createTaskDOMElements || null,
            setupTaskInteractions: dependencies.setupTaskInteractions || null,
            finalizeTaskCreation: dependencies.finalizeTaskCreation || null,

            // Auto-save
            autoSave: dependencies.autoSave || (() => console.log('⏭️ autoSave not available'))
        };

        console.log('🎯 TaskCore module initialized');
    }

    /**
     * Initialize task core system
     * Must be called after DOM is ready and appInit core is ready
     */
    async init() {
        console.log('🔄 Initializing task core system...');

        // Wait for core systems to be ready
        await appInit.waitForCore();

        try {
            console.log('✅ Task core system initialized successfully');
        } catch (error) {
            console.warn('⚠️ Task core system initialization failed:', error);
            this.deps.showNotification('Task system initialized with limited functionality', 'warning');
        }
    }

    // ============================================================================
    // FALLBACK METHODS
    // ============================================================================

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
    async addTask(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}) {
        try {
            // Wait for core to be ready
            await appInit.waitForCore();

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
                completed, dueDate, highPriority, remindersEnabled, recurring, recurringSettings
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

            // Finalize task creation
            this.deps.finalizeTaskCreation?.(taskElements, taskContext, { shouldSave, isLoading });

            console.log('✅ Task creation completed (Schema 2.5)');

        } catch (error) {
            console.warn('⚠️ Task creation failed:', error);
            this.deps.showNotification('Could not add task - please try again', 'warning');
        }
    }

    /**
     * Edit an existing task's text
     * @param {HTMLElement} taskItem - The task DOM element
     */
    async editTask(taskItem) {
        try {
            await appInit.waitForCore();

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
                                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                                    fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
                                    fullSchemaData.metadata.lastModified = Date.now();
                                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                                }
                            }
                        }

                        this.deps.showNotification(`Task renamed to "${cleanText}"`, "info", 1500);
                        this.deps.updateStatsPanel();
                        this.deps.updateProgressBar();
                        this.deps.checkCompleteAllButton();
                    }
                }
            });

        } catch (error) {
            console.warn('⚠️ Task edit failed:', error);
            this.deps.showNotification('Could not edit task', 'warning');
        }
    }

    /**
     * Delete a task with confirmation
     * @param {HTMLElement} taskItem - The task DOM element
     */
    async deleteTask(taskItem) {
        try {
            await appInit.waitForCore();

            const taskId = taskItem.dataset.taskId;
            const taskName = taskItem.querySelector(".task-text")?.textContent || "Task";

            this.deps.showConfirmationModal({
                title: "Delete Task",
                message: `Are you sure you want to delete "${taskName}"?`,
                confirmText: "Delete",
                cancelText: "Cancel",
                callback: async (confirmDelete) => {
                    if (!confirmDelete) {
                        this.deps.showNotification(`"${taskName}" has not been deleted.`, "show", 2500);
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

                        this.deps.showNotification(`Task "${taskName}" deleted.`, "show", 2500);
                        this.deps.updateStatsPanel();
                        this.deps.updateProgressBar();
                        this.deps.checkCompleteAllButton();

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
                                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                                fullSchemaData.data.cycles[activeCycle].tasks = tasks;
                                fullSchemaData.metadata.lastModified = Date.now();
                                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                                taskItem.remove();
                                this.deps.showNotification(`Task "${taskName}" deleted.`, "show", 2500);
                                this.deps.updateStatsPanel();
                                this.deps.updateProgressBar();
                                this.deps.checkCompleteAllButton();
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.warn('⚠️ Task deletion failed:', error);
            this.deps.showNotification('Could not delete task', 'warning');
        }
    }

    /**
     * Toggle task priority (high/normal)
     * @param {HTMLElement} taskItem - The task DOM element
     */
    async toggleTaskPriority(taskItem) {
        try {
            await appInit.waitForCore();

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

                this.deps.showNotification(
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
                        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                        fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                        this.deps.showNotification(
                            `Priority ${task.highPriority ? "enabled" : "removed"}.`,
                            task.highPriority ? "error" : "info",
                            1500
                        );
                    }
                }
            }

        } catch (error) {
            console.warn('⚠️ Priority toggle failed:', error);
            this.deps.showNotification('Could not toggle priority', 'warning');
        }
    }

    // ============================================================================
    // PLACEHOLDER METHODS (to be extracted next)
    // ============================================================================

    // These will be extracted from main script in next steps:
    // - saveCurrentTaskOrder()
    // - resetTasks()
    // - handleCompleteAllTasks()
    // - toggleTaskCompletion()
}

// ============================================================================
// GLOBAL INSTANCE & INITIALIZATION
// ============================================================================

let taskCoreInstance = null;

/**
 * Initialize the task core module with dependencies
 * @param {object} dependencies - Dependency injection configuration
 * @returns {Promise<TaskCore>} The initialized TaskCore instance
 */
export async function initTaskCore(dependencies = {}) {
    if (!taskCoreInstance) {
        taskCoreInstance = new TaskCore(dependencies);
        await taskCoreInstance.init();

        // Make available globally for backward compatibility
        window.taskCore = taskCoreInstance;

        // Export individual methods globally
        window.addTask = (...args) => taskCoreInstance.addTask(...args);
        window.editTaskFromCore = (taskItem) => taskCoreInstance.editTask(taskItem);
        window.deleteTaskFromCore = (taskItem) => taskCoreInstance.deleteTask(taskItem);
        window.toggleTaskPriorityFromCore = (taskItem) => taskCoreInstance.toggleTaskPriority(taskItem);

        console.log('✅ TaskCore initialized and globally available');
    }
    return taskCoreInstance;
}

export { taskCoreInstance };
