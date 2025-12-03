/**
 * 🎨 miniCycle Task Renderer
 * Handles task rendering and UI refresh operations
 *
 * Pattern: Simple Instance 🎯
 * - Manages rendering state
 * - Coordinates with other modules
 * - Updates UI components
 *
 * @module modules/task/taskRenderer
 * @version 1.389
 */

// Module-level deps for late injection
let _deps = {};

/**
 * Set dependencies for TaskRenderer (call before initTaskRenderer)
 * @param {Object} dependencies - { AppState, updateProgressBar, etc. }
 */
export function setTaskRendererDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('🎨 TaskRenderer dependencies set:', Object.keys(dependencies));
}

export class TaskRenderer {
    constructor(dependencies = {}) {
        // Merge injected deps with constructor deps (constructor takes precedence)
        const mergedDeps = { ..._deps, ...dependencies };

        // Store dependencies - no window.* fallbacks
        this.deps = {
            // Core data access (required)
            AppState: mergedDeps.AppState,

            // Task management functions (required)
            addTask: mergedDeps.addTask,
            loadMiniCycle: mergedDeps.loadMiniCycle,

            // UI update functions (required)
            updateProgressBar: mergedDeps.updateProgressBar,
            checkCompleteAllButton: mergedDeps.checkCompleteAllButton,
            updateStatsPanel: mergedDeps.updateStatsPanel,
            updateMainMenuHeader: mergedDeps.updateMainMenuHeader,
            updateArrowsInDOM: mergedDeps.updateArrowsInDOM,
            checkOverdueTasks: mergedDeps.checkOverdueTasks,

            // Drag-drop (required)
            enableDragAndDropOnTask: mergedDeps.enableDragAndDropOnTask,

            // Recurring panel (required)
            recurringPanel: mergedDeps.recurringPanel,
            updateRecurringPanelButtonVisibility: mergedDeps.updateRecurringPanelButtonVisibility,

            // DOM helpers
            getElementById: mergedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: mergedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Validate required dependencies
        this._validateDependencies();

        // Instance version
        this.version = '1.389';

        console.log('🎨 TaskRenderer created');
    }

    /**
     * Validate dependencies and warn about missing ones
     * Note: Dependencies are optional for backward compatibility with TaskDOMManager
     * @private
     */
    _validateDependencies() {
        const recommended = [
            'AppState',
            'addTask',
            'loadMiniCycle',
            'updateProgressBar',
            'checkCompleteAllButton',
            'updateArrowsInDOM',
            'checkOverdueTasks',
            'enableDragAndDropOnTask',
            'recurringPanel',
            'updateRecurringPanelButtonVisibility'
        ];

        const missing = recommended.filter(dep => !this.deps[dep]);

        if (missing.length > 0) {
            console.warn('⚠️ TaskRenderer missing dependencies (some features may not work):', missing);
        }
    }

    /**
     * Render tasks array to DOM
     * @param {Array} tasksArray - Array of task objects
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

        // ✅ FIX #6: Use DocumentFragment for batched DOM updates
        const fragment = document.createDocumentFragment();

        // Add all tasks to fragment (batch operation)
        for (const task of tasksArray) {
            if (!task || !task.id) {
                console.warn('⚠️ Skipping invalid task:', task);
                continue;
            }

            // Use injected addTask with batch mode (fallback to window.addTask for backward compat)
            const addTaskFn = this.deps.addTask || window.addTask;
            if (addTaskFn) {
                await addTaskFn(
                    task.text,
                    task.completed,
                    false,                     // shouldSave: false (don't save during render)
                    task.dueDate,
                    task.highPriority,
                    true,                      // isLoading: true (avoid overdue reminder popups)
                    task.remindersEnabled,
                    task.recurring,
                    task.id,
                    task.recurringSettings,
                    true,                      // ✅ FIX #6: deferAppend: batch mode
                    fragment                   // ✅ FIX #6: targetContainer: append to fragment
                );
            } else {
                console.warn('⚠️ addTask function not available for task:', task.id);
            }
        }

        // ✅ FIX #6: Append entire fragment to DOM in one operation (single reflow)
        taskList.appendChild(fragment);

        // Re-run UI state updates
        this.deps.updateProgressBar?.();
        this.deps.checkCompleteAllButton?.();
        this.deps.updateStatsPanel?.();

        // Update recurring panel
        this.deps.updateRecurringPanelButtonVisibility?.();

        // Check overdue tasks after rendering
        setTimeout(() => {
            this.deps.checkOverdueTasks?.();
        }, 500);

        // ✅ FIX: Re-initialize drag handlers on newly rendered tasks
        // This is needed after refreshUIFromState() recreates the DOM
        if (this.deps.enableDragAndDropOnTask) {
            const tasks = this.deps.querySelectorAll('#taskList .task');
            tasks.forEach(task => {
                this.deps.enableDragAndDropOnTask(task);
            });
            console.log(`🎯 Re-initialized drag handlers for ${tasks.length} tasks`);
        }

        console.log('✅ Tasks rendered successfully (batched DOM update)');
    }

    /**
     * Refresh UI from state (re-render tasks from AppState or localStorage)
     * @param {Object} providedState - Optional state object (uses AppState if not provided)
     * NOTE: Can only be called after Phase 2 complete (TaskDOMManager ready)
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
                const updateArrows = this.deps.updateArrowsInDOM || window.updateArrowsInDOM;
                updateArrows?.(arrowsVisible);

                // Update other UI bits that don't depend on reloading storage
                const recurringPanel = this.deps.recurringPanel || window.recurringPanel;
                recurringPanel?.updateRecurringPanel?.();
                recurringPanel?.updateRecurringPanelButtonVisibility?.();

                const updateMainMenuHeader = this.deps.updateMainMenuHeader || window.updateMainMenuHeader;
                updateMainMenuHeader?.();

                this.deps.updateProgressBar?.();
                this.deps.checkCompleteAllButton?.();
                return;
            }
        }

        // Fallback: load from localStorage
        const loadMiniCycle = this.deps.loadMiniCycle || window.loadMiniCycle;
        loadMiniCycle?.();

        // ✅ Also restore arrow visibility after fallback load
        setTimeout(() => {
            if (this.deps.AppState?.isReady?.()) {
                const currentState = this.deps.AppState.get();
                const arrowsVisible = currentState?.ui?.moveArrowsVisible || false;
                const updateArrows = this.deps.updateArrowsInDOM || window.updateArrowsInDOM;
                updateArrows?.(arrowsVisible);
            }
        }, 50);
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
// Global Instance Management
// ============================================

let taskRenderer = null;

/**
 * Initialize the global task renderer
 * @param {Object} dependencies - Required dependencies
 */
export function initTaskRenderer(dependencies = {}) {
    if (taskRenderer) {
        console.warn('⚠️ TaskRenderer already initialized');
        return taskRenderer;
    }

    taskRenderer = new TaskRenderer(dependencies);
    return taskRenderer;
}

// ============================================
// Wrapper Functions
// ============================================

async function renderTasks(tasksArray) {
    if (!taskRenderer) {
        console.warn('⚠️ TaskRenderer not initialized');
        return;
    }
    return await taskRenderer.renderTasks(tasksArray);
}

async function refreshUIFromState(providedState) {
    if (!taskRenderer) {
        console.warn('⚠️ TaskRenderer not initialized');
        return;
    }
    return await taskRenderer.refreshUIFromState(providedState);
}

async function refreshTaskListUI() {
    if (!taskRenderer) {
        console.warn('⚠️ TaskRenderer not initialized');
        return;
    }
    return await taskRenderer.refreshTaskListUI();
}

// ============================================
// Exports
// ============================================

// Phase 2 Step 8 - Clean exports (no window.* pollution)
console.log('🎨 TaskRenderer module loaded (Phase 2 - no window.* exports)');

// ES6 exports
export {
    renderTasks,
    refreshUIFromState,
    refreshTaskListUI
};
