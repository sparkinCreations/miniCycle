/**
 * 🎨 miniCycle Task Renderer
 * Handles task rendering and UI refresh operations
 *
 * Pattern: Simple Instance 🎯
 * - Manages rendering state
 * - Coordinates with other modules
 * - Updates UI components
 *
 * @module utilities/task/taskRenderer
 * @version 1.3
 */

export class TaskRenderer {
    constructor(dependencies = {}) {
        // Store dependencies with fallbacks
        this.deps = {
            // Core data access
            AppState: dependencies.AppState || window.AppState,

            // UI update functions
            updateProgressBar: dependencies.updateProgressBar || this.fallbackUpdate,
            checkCompleteAllButton: dependencies.checkCompleteAllButton || this.fallbackUpdate,
            updateStatsPanel: dependencies.updateStatsPanel || this.fallbackUpdate,
            updateMainMenuHeader: dependencies.updateMainMenuHeader || this.fallbackUpdate,

            // DOM helpers
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id))
        };

        // Instance version
        this.version = '1.3';

        console.log('🎨 TaskRenderer created');
    }

    // Fallback functions
    fallbackUpdate() {
        // Silent fallback - just a no-op
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

        tasksArray.forEach(task => {
            if (!task || !task.id) {
                console.warn('⚠️ Skipping invalid task:', task);
                return;
            }

            // Use window.addTask (from taskCore) to render each task
            if (typeof window.addTask === 'function') {
                window.addTask(
                    task.text,
                    task.completed,
                    false,                     // shouldSave: false (don't save during render)
                    task.dueDate,
                    task.highPriority,
                    true,                      // isLoading: true (avoid overdue reminder popups)
                    task.remindersEnabled,
                    task.recurring,
                    task.id,
                    task.recurringSettings
                );
            } else {
                console.warn('⚠️ addTask function not available');
            }
        });

        // Re-run UI state updates
        this.deps.updateProgressBar?.();
        this.deps.checkCompleteAllButton?.();
        this.deps.updateStatsPanel?.();

        // Update recurring panel
        if (typeof window.updateRecurringPanelButtonVisibility === 'function') {
            window.updateRecurringPanelButtonVisibility();
        }

        // Check overdue tasks after rendering
        if (typeof window.checkOverdueTasks === 'function') {
            setTimeout(() => {
                window.checkOverdueTasks();
            }, 500);
        }

        console.log('✅ Tasks rendered successfully');
    }

    /**
     * Refresh UI from state (re-render tasks from AppState or localStorage)
     * @param {Object} providedState - Optional state object (uses AppState if not provided)
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
                if (typeof window.updateArrowsInDOM === 'function') {
                    window.updateArrowsInDOM(arrowsVisible);
                }

                // Update other UI bits that don't depend on reloading storage
                if (window.recurringPanel?.updateRecurringPanel) {
                    window.recurringPanel.updateRecurringPanel();
                }
                if (window.recurringPanel?.updateRecurringPanelButtonVisibility) {
                    window.recurringPanel.updateRecurringPanelButtonVisibility();
                }
                if (typeof window.updateMainMenuHeader === 'function') {
                    window.updateMainMenuHeader();
                }

                this.deps.updateProgressBar?.();
                this.deps.checkCompleteAllButton?.();
                return;
            }
        }

        // Fallback: load from localStorage
        if (typeof window.loadMiniCycle === 'function') {
            window.loadMiniCycle();

            // ✅ Also restore arrow visibility after fallback load
            setTimeout(() => {
                if (this.deps.AppState?.isReady?.()) {
                    const currentState = this.deps.AppState.get();
                    const arrowsVisible = currentState?.ui?.moveArrowsVisible || false;
                    if (typeof window.updateArrowsInDOM === 'function') {
                        window.updateArrowsInDOM(arrowsVisible);
                    }
                }
            }, 50);
        }
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

// ES6 exports
export {
    renderTasks,
    refreshUIFromState,
    refreshTaskListUI
};

// Window exports (CRITICAL for ES6 module scope)
window.TaskRenderer = TaskRenderer;
window.initTaskRenderer = initTaskRenderer;
window.renderTasks = renderTasks;
window.refreshUIFromState = refreshUIFromState;
window.refreshTaskListUI = refreshTaskListUI;

console.log('🎨 TaskRenderer module loaded and ready');
