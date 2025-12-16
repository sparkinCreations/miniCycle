/**
 * 🎨 miniCycle Task Renderer (DI-Pure)
 * Handles task rendering and UI refresh operations
 *
 * Pattern: Simple Instance 🎯
 * - Manages rendering state
 * - Coordinates with other modules
 * - Updates UI components
 *
 * @module modules/task/taskRenderer
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TaskRenderer', {
    AppState: optional(null),
    addTask: optional(null),
    loadMiniCycle: optional(null),
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    updateStatsPanel: optional(null),
    updateMainMenuHeader: optional(null),
    updateArrowsInDOM: optional(null),
    checkOverdueTasks: optional(null),
    enableDragAndDropOnTask: optional(null),
    recurringPanel: optional(null),
    updateRecurringPanelButtonVisibility: optional(null),
    AppMeta: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskRenderer (call before initTaskRenderer)
 * @param {Object} dependencies - { AppState, updateProgressBar, etc. }
 */
export function setTaskRendererDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎨 TaskRenderer dependencies set:', Object.keys(dependencies));
}

export class TaskRenderer {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        // Store dependencies - no window.* fallbacks
        this.deps = {
            // Core data access (required)
            AppState: resolvedDeps.AppState,

            // Task management functions (required)
            addTask: resolvedDeps.addTask,
            loadMiniCycle: resolvedDeps.loadMiniCycle,

            // UI update functions (required)
            updateProgressBar: resolvedDeps.updateProgressBar,
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton,
            updateStatsPanel: resolvedDeps.updateStatsPanel,
            updateMainMenuHeader: resolvedDeps.updateMainMenuHeader,
            updateArrowsInDOM: resolvedDeps.updateArrowsInDOM,
            checkOverdueTasks: resolvedDeps.checkOverdueTasks,

            // Drag-drop (required)
            enableDragAndDropOnTask: resolvedDeps.enableDragAndDropOnTask,

            // Recurring panel (required)
            recurringPanel: resolvedDeps.recurringPanel,
            updateRecurringPanelButtonVisibility: resolvedDeps.updateRecurringPanelButtonVisibility,

            // DOM helpers
            getElementById: resolvedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: resolvedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Validate required dependencies
        this._validateDependencies();

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

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

            // Use injected addTask
            if (this.deps.addTask) {
                await this.deps.addTask(
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
                    task.deleteWhenComplete,   // ✅ FIX: Pass actual deleteWhenComplete value
                    task.deleteWhenCompleteSettings  // ✅ FIX: Pass actual deleteWhenCompleteSettings
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
                this.deps.updateArrowsInDOM?.(arrowsVisible);

                // Update other UI bits that don't depend on reloading storage
                this.deps.recurringPanel?.updateRecurringPanel?.();
                this.deps.recurringPanel?.updateRecurringPanelButtonVisibility?.();

                this.deps.updateMainMenuHeader?.();

                this.deps.updateProgressBar?.();
                this.deps.checkCompleteAllButton?.();
                return;
            }
        }

        // Fallback: load from localStorage
        this.deps.loadMiniCycle?.();

        // ✅ Also restore arrow visibility after fallback load
        setTimeout(() => {
            if (this.deps.AppState?.isReady?.()) {
                const currentState = this.deps.AppState.get();
                const arrowsVisible = currentState?.ui?.moveArrowsVisible || false;
                this.deps.updateArrowsInDOM?.(arrowsVisible);
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
