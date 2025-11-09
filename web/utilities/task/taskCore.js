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
 * @version 1.345
 */

import { appInit } from '../appInitialization.js';

export class TaskCore {
    constructor(dependencies = {}) {
        this.version = '1.345';

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

        // Wait for core systems to be ready (with timeout for test environments)
        try {
            await Promise.race([
                appInit.waitForCore(),
                new Promise((resolve) => setTimeout(resolve, 1000)) // 1s timeout for tests
            ]);
            console.log('✅ Task core system initialized successfully');
        } catch (error) {
            console.warn('⚠️ Task core system initialization failed:', error);
            this.deps.showNotification('Task system initialized with limited functionality', 'warning');
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
                appInit.waitForCore(),
                new Promise((resolve) => setTimeout(resolve, 100)) // 100ms timeout for tests
            ]);
        } catch (error) {
            console.warn('⚠️ Core wait timeout or error:', error);
        }
    }

    /**
     * Wait for specific global functions to be available
     * Used by resetTasks to ensure UI functions exist before calling them
     */
    async waitForUIFunctions(maxWaitMs = 2000) {
        const startTime = Date.now();
        const checkInterval = 50; // Check every 50ms

        while (Date.now() - startTime < maxWaitMs) {
            const hasIncrementCycleCount = typeof window.incrementCycleCount === 'function';
            const hasHelpWindowManager = window.helpWindowManager && typeof window.helpWindowManager.showCycleCompleteMessage === 'function';
            const hasShowCompletionAnimation = typeof window.showCompletionAnimation === 'function';

            if (hasIncrementCycleCount && hasHelpWindowManager && hasShowCompletionAnimation) {
                console.log('✅ All UI functions available for resetTasks');
                return true;
            }

            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        console.warn('⚠️ Timeout waiting for UI functions:', {
            incrementCycleCount: typeof window.incrementCycleCount === 'function',
            helpWindowManager: window.helpWindowManager && typeof window.helpWindowManager.showCycleCompleteMessage === 'function',
            showCompletionAnimation: typeof window.showCompletionAnimation === 'function'
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
    // TASK COMPLETION & STATE MANAGEMENT
    // ============================================================================

    /**
     * Handle task completion checkbox change
     * @param {HTMLInputElement} checkbox - The checkbox element
     */
    async handleTaskCompletionChange(checkbox) {
        try {
            const taskItem = checkbox.closest(".task");

            if (checkbox.checked) {
                taskItem.classList.remove("overdue-task");
            } else {
                // Check if task is overdue
                if (typeof window.checkOverdueTasks === 'function') {
                    window.checkOverdueTasks(taskItem);
                }
            }

            // Update help window if available
            if (window.helpWindowManager && typeof window.helpWindowManager.updateConstantMessage === 'function') {
                setTimeout(() => {
                    window.helpWindowManager.updateConstantMessage();
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

            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

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
        if (window.AppState && window.AppState.isReady()) {
            try {
                window.AppState.update(state => {
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
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            if (fullSchemaData && fullSchemaData.data && fullSchemaData.data.cycles) {
                fullSchemaData.data.cycles[activeCycle] = currentCycle;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
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
            if (window.AppGlobalState?.isResetting) return;
            window.AppGlobalState.isResetting = true;

            console.log('🔄 Resetting tasks (Schema 2.5 only)...');

            // Wait for critical UI functions to be available
            console.log('⏳ Waiting for UI functions (helpWindowManager, incrementCycleCount, etc.)...');
            await this.waitForUIFunctions();

            let cycles, activeCycle, cycleData;
            const taskList = this.deps.querySelector("#taskList");
            const taskElements = taskList ? [...taskList.querySelectorAll(".task")] : [];
            const progressBar = this.deps.querySelector("#progressBar");

            // Validate DOM elements
            if (!taskList) {
                console.error('❌ Task list element not found');
                window.AppGlobalState.isResetting = false;
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
                    window.AppGlobalState.isResetting = false;
                    throw new Error('Schema 2.5 data not found');
                }
                cycles = schemaData.data?.cycles || {};
                activeCycle = schemaData.appState?.activeCycleId;
                cycleData = cycles[activeCycle];
            }

            if (!activeCycle || !cycleData) {
                console.error("❌ No active cycle found in Schema 2.5 for resetTasks");
                window.AppGlobalState.isResetting = false;
                return;
            }

            console.log('📊 Resetting tasks for cycle:', activeCycle);

            // ✅ CAPTURE UNDO SNAPSHOT BEFORE ANY MODIFICATIONS
            if (typeof window.captureStateSnapshot === 'function' && !window.AppGlobalState?.isPerformingUndoRedo) {
                const currentState = this.deps.AppState?.get?.();
                if (currentState) {
                    window.captureStateSnapshot(currentState);
                    console.log('📸 Undo snapshot captured BEFORE task reset (includes current cycle count and task states)');
                }
            }

            // Animation: Show progress bar becoming full first
            if (progressBar) {
                progressBar.style.width = "100%";
                progressBar.style.transition = "width 0.2s ease-out";
            }

            // Wait for animation, then reset tasks
            setTimeout(() => {
                console.log('🧹 Removing recurring tasks and resetting non-recurring tasks');

                // Remove recurring tasks
                if (typeof window.removeRecurringTasksFromCycle === 'function') {
                    window.removeRecurringTasksFromCycle(taskElements, cycleData);
                }

                // ✅ Update task data AND DOM for non-recurring tasks
                taskElements.forEach(taskEl => {
                    const isRecurring = taskEl.classList.contains("recurring");
                    if (isRecurring) return;

                    const taskId = taskEl.dataset.taskId;
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
                    if (taskId && cycleData?.tasks) {
                        const task = cycleData.tasks.find(t => t.id === taskId);
                        if (task) {
                            task.completed = false;
                            task.dueDate = null;
                            console.log(`✅ Reset task data for: ${task.text}`);
                        }
                    }
                });

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
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    if (fullSchemaData?.data?.cycles?.[activeCycle]) {
                        fullSchemaData.data.cycles[activeCycle] = cycleData;
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                        console.log('✅ Reset task data saved to localStorage (AppState fallback)');
                    }
                }

                // Increment cycle count (this calls showCompletionAnimation internally)
                window.incrementCycleCount(activeCycle, cycles);

                // Animate progress bar reset
                if (progressBar) {
                    progressBar.style.transition = "width 0.3s ease-in";
                    progressBar.style.width = "0%";

                    setTimeout(() => {
                        progressBar.style.transition = "";
                    }, 50);
                }

                // Show cycle completion message
                window.helpWindowManager.showCycleCompleteMessage();

                // ✅ Update undo/redo buttons to reflect the new snapshot
                if (typeof window.updateUndoRedoButtons === 'function') {
                    window.updateUndoRedoButtons();
                    console.log('✅ Undo/redo buttons updated after cycle completion');
                }

                console.log('✅ Task reset animation completed');

            }, 100);

            // Release reset lock
            setTimeout(() => {
                window.AppGlobalState.isResetting = false;
                console.log('🔓 Reset lock released');
            }, 2000);

            // Post-reset cleanup
            setTimeout(() => {
                console.log('🔄 Running post-reset cleanup tasks');
                if (window.recurringCore?.watchRecurringTasks) {
                    window.recurringCore.watchRecurringTasks();
                }
                this.deps.autoSave();
                this.deps.updateStatsPanel();
                console.log('✅ Reset tasks completed successfully');
            }, 1000);

        } catch (error) {
            console.warn('⚠️ Reset tasks failed:', error);
            window.AppGlobalState.isResetting = false;
            this.deps.showNotification('Could not reset tasks', 'warning');
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
                                const checkedTasks = document.querySelectorAll(".task input:checked");
                                if (checkedTasks.length === 0) {
                                    this.deps.showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                                    return;
                                }

                                checkedTasks.forEach(checkbox => {
                                    const taskId = checkbox.closest(".task").dataset.taskId;
                                    cycleData.tasks = cycleData.tasks.filter(t => t.id !== taskId);
                                    checkbox.closest(".task").remove();
                                });

                                this.deps.autoSave();

                            } else {
                                taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                                if (typeof window.checkMiniCycle === 'function') {
                                    window.checkMiniCycle();
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
                const checkedTasks = document.querySelectorAll(".task input:checked");
                if (checkedTasks.length === 0) {
                    this.deps.showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                    return;
                }

                console.log('🗑️ Deleting checked tasks from Schema 2.5');

                const taskIdsToDelete = Array.from(checkedTasks).map(checkbox => {
                    const taskId = checkbox.closest(".task").dataset.taskId;
                    checkbox.closest(".task").remove();
                    return taskId;
                });

                // Update data (AppState or localStorage)
                if (this.deps.AppState?.isReady?.()) {
                    await this.deps.AppState.update(state => {
                        const cid = state.appState.activeCycleId;
                        const cycle = state.data.cycles[cid];
                        if (cycle?.tasks) {
                            cycle.tasks = cycle.tasks.filter(t => !taskIdsToDelete.includes(t.id));
                        }
                    }, true);
                } else {
                    // Fallback to localStorage
                    cycleData.tasks = cycleData.tasks.filter(t => !taskIdsToDelete.includes(t.id));
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle] = cycleData;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                }

            } else {
                console.log('✔️ Marking all tasks as complete');

                taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                if (typeof window.checkMiniCycle === 'function') {
                    window.checkMiniCycle();
                }

                // Only call resetTasks() if autoReset is OFF
                if (!cycleData.autoReset) {
                    setTimeout(() => this.resetTasks(), 1000);
                }
            }

            console.log('✅ Complete all tasks handled (Schema 2.5)');

        } catch (error) {
            console.warn('⚠️ Complete all tasks failed:', error);
            this.deps.showNotification('Could not complete all tasks', 'warning');
        }
    }
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
        window.TaskCore = TaskCore; // Export class for testing
        window.taskCore = taskCoreInstance;

        // Export individual methods globally
        window.addTask = (...args) => taskCoreInstance.addTask(...args);
        window.editTaskFromCore = (taskItem) => taskCoreInstance.editTask(taskItem);
        window.deleteTaskFromCore = (taskItem) => taskCoreInstance.deleteTask(taskItem);
        window.toggleTaskPriorityFromCore = (taskItem) => taskCoreInstance.toggleTaskPriority(taskItem);

        // Export new batch operations
        window.handleTaskCompletionChange = (checkbox) => taskCoreInstance.handleTaskCompletionChange(checkbox);
        window.saveCurrentTaskOrder = () => taskCoreInstance.saveCurrentTaskOrder();
        window.saveTaskToSchema25 = (cycleId, cycleData) => taskCoreInstance.saveTaskToSchema25(cycleId, cycleData);
        window.resetTasks = () => taskCoreInstance.resetTasks();
        window.handleCompleteAllTasks = () => taskCoreInstance.handleCompleteAllTasks();

        console.log('✅ TaskCore initialized and globally available');
    }
    return taskCoreInstance;
}

export { taskCoreInstance };
