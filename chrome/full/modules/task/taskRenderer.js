/**
 * miniCycle Task Renderer
 *
 * Handles task rendering and UI refresh operations using atomic DOM updates.
 * Uses DocumentFragment and replaceChildren for efficient batch rendering.
 *
 * Features:
 * - Atomic DOM updates (single reflow per render)
 * - State-driven UI restoration
 * - Drag-drop re-initialization after render
 * - Search visibility updates
 *
 * @module task/taskRenderer
 * @version 1.0.0
 * @see {@link module:task/taskCRUD} - Task creation logic
 * @see {@link module:task/taskDOM} - DOM element creation
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
// NOTE: taskToAddTaskOptions injected via DI to avoid duplicate module loading

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
    updateRecurringInfoLink: optional(null),
    updateSearchVisibility: optional(null),  // Task search visibility based on count
    AppMeta: optional(null),
    taskToAddTaskOptions: optional(null),  // From taskUtils - injected to avoid duplicate module loading
    revealTaskButtons: optional(null)  // For restoring active task options after render
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null, addTask: Function|null, loadMiniCycle: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, updateStatsPanel: Function|null, updateMainMenuHeader: Function|null, updateArrowsInDOM: Function|null, checkOverdueTasks: Function|null, enableDragAndDropOnTask: Function|null, recurringPanel: Object|null, updateRecurringPanelButtonVisibility: Function|null, updateSearchVisibility: Function|null, AppMeta: Object|null, taskToAddTaskOptions: Function|null, revealTaskButtons: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskRenderer (call before initTaskRenderer)
 * @param {Object} dependencies - { AppState, updateProgressBar, etc. }
 * @returns {void}
 */
export function setTaskRendererDependencies(dependencies) {
    di.setDependencies(dependencies);
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

            // Drag-drop (may be late-injected)
            enableDragAndDropOnTask: resolvedDeps.enableDragAndDropOnTask,

            // Recurring panel (required)
            recurringPanel: resolvedDeps.recurringPanel,
            updateRecurringPanelButtonVisibility: resolvedDeps.updateRecurringPanelButtonVisibility,
            updateRecurringInfoLink: resolvedDeps.updateRecurringInfoLink,

            // Task search visibility
            updateSearchVisibility: resolvedDeps.updateSearchVisibility,

            // Task utilities (required for rendering)
            taskToAddTaskOptions: resolvedDeps.taskToAddTaskOptions,

            // Task options visibility (for restoring active task after render)
            revealTaskButtons: resolvedDeps.revealTaskButtons,

            // DOM helpers
            getElementById: resolvedDeps.getElementById || ((id) => document.getElementById(id)),
            querySelectorAll: resolvedDeps.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Validate required dependencies
        this._validateDependencies();

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;

    }

    /**
     * Inject a dependency after construction (for late-bound dependencies)
     * @param {string} name - The dependency name
     * @param {*} value - The dependency value
     * @returns {void}
     */
    injectDependency(name, value) {
        this.deps[name] = value;
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
     * Render tasks array to DOM using atomic replaceChildren.
     * Uses DocumentFragment for efficient batch DOM operations.
     *
     * @param {Task[]} [tasksArray=[]] - Array of task objects to render
     * @returns {Promise<void>}
     */
    async renderTasks(tasksArray = []) {

        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) {
            console.warn('⚠️ Task list container not found');
            return;
        }

        if (!Array.isArray(tasksArray)) {
            console.warn('⚠️ Invalid tasks array provided to renderTasks');
            return;
        }

        // ✅ Create DocumentFragment for batched DOM operations
        // Using try/catch to preserve existing DOM if rendering fails mid-way
        const fragment = document.createDocumentFragment();
        let renderSuccess = true;

        try {
            // Build all task elements in fragment (no reflows during construction)
            for (const task of tasksArray) {
                if (!task || !task.id) {
                    console.warn('⚠️ Skipping invalid task:', task);
                    continue;
                }

                // Use injected addTask with deferred append to fragment
                if (this.deps.addTask && this.deps.taskToAddTaskOptions) {
                    const options = this.deps.taskToAddTaskOptions(task);
                    // Defer append and use fragment as target container
                    options.deferAppend = true;
                    options.targetContainer = fragment;
                    await this.deps.addTask(task.text, options);
                } else {
                    console.warn('⚠️ addTask or taskToAddTaskOptions not available for task:', task.id);
                }
            }
        } catch (error) {
            console.error('❌ Error building task elements, preserving existing DOM:', error);
            renderSuccess = false;
        }

        // Only replace DOM if all tasks rendered successfully
        if (renderSuccess) {
            // ✅ Atomic DOM update. When the completed dropdown is enabled, project BOTH lists
            // from state in one pass: partition the freshly-built nodes by task.completed and
            // replaceChildren each list. This makes the dropdown a projection of state rather
            // than a re-sort of the active list AFTER the fact (the seam that produced the
            // duplicate-in-completed bug). See docs/future-work/RENDER_PATH_UNIFICATION.md.
            const ctm = this.deps.completedTasksManager;
            const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
            const dropdownEnabled = !!(completedList && ctm?.isEnabled?.());

            if (dropdownEnabled) {
                const completedById = new Map(tasksArray.map(t => [t.id, t?.completed === true]));
                const activeFrag = document.createDocumentFragment();
                const completedFrag = document.createDocumentFragment();

                Array.from(fragment.childNodes).forEach(node => {
                    const id = node.dataset?.taskId;
                    if (id && completedById.get(id)) {
                        ctm.prepareCompletedNode?.(node);
                        completedFrag.appendChild(node);
                    } else {
                        activeFrag.appendChild(node);
                    }
                });

                taskList.replaceChildren(...activeFrag.childNodes);
                completedList.replaceChildren(...completedFrag.childNodes);
                ctm.updateCount?.(); // count badge + section show/hide
            } else {
                // ✅ Atomic DOM update: replaceChildren swaps all children in one reflow
                taskList.replaceChildren(...fragment.childNodes);
                // Feature off: clear any completed nodes left over from a prior enabled render.
                if (completedList && completedList.childElementCount > 0) {
                    completedList.replaceChildren();
                    ctm?.updateCount?.();
                }
            }

            // Toggle tasks-empty class on body for shimmer effect
            // Uses managed class instead of :has(.task-list:empty) for PWA reliability
            document.body.classList.toggle(DOM_CLASSES.TASKS_EMPTY, taskList.children.length === 0);
        } else {
            console.warn('⚠️ Render failed - existing task list preserved');
            return;
        }

        // Re-run UI state updates
        this.deps.updateProgressBar?.();
        this.deps.checkCompleteAllButton?.();
        this.deps.updateStatsPanel?.();

        // Update recurring panel
        this.deps.updateRecurringPanelButtonVisibility?.();
        this.deps.updateRecurringInfoLink?.();

        // Check overdue tasks after rendering
        setTimeout(() => {
            this.deps.checkOverdueTasks?.();
        }, 500);

        // Re-initialize drag handlers on newly rendered tasks
        if (this.deps.enableDragAndDropOnTask) {
            const tasks = this.deps.querySelectorAll('#taskList .task');
            tasks.forEach(task => {
                this.deps.enableDragAndDropOnTask(task);
            });
        }

        // Restore active task options from state (state-driven UI)
        this._restoreActiveTaskOptions();

        // Note: the completed-tasks dropdown is now projected from state during the atomic
        // swap above (render-path unification). organize() is no longer needed here — it
        // remains only for PATCH renders (undo/redo un-complete updates a checkbox in place
        // without re-rendering), where its dedup/up-direction logic is still load-bearing.

        // Update task search visibility based on count
        this.deps.updateSearchVisibility?.(tasksArray.length);

    }

    /**
     * Refresh UI from state (re-render tasks from AppState).
     * Falls back to loadMiniCycle if state is not available.
     *
     * NOTE: Can only be called after Phase 2 complete (TaskDOMManager ready).
     *
     * @param {Object|null} [providedState=null] - Optional state object (uses AppState if not provided)
     * @returns {Promise<void>}
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
                this.deps.updateRecurringInfoLink?.();

                this.deps.updateMainMenuHeader?.();

                this.deps.updateProgressBar?.();
                this.deps.checkCompleteAllButton?.();

                // Sync task input placeholder with active theme
                const taskInputEl = document.getElementById(DOM_IDS.TASK_INPUT);
                if (taskInputEl) taskInputEl.placeholder = getLabel('action.addTask');

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

    /**
     * Restore active task options from AppState (state-driven UI)
     * Called after renderTasks to ensure task options are shown for the active task.
     *
     * Only runs when `ui.shouldRestoreActiveTaskOptions` is explicitly set to true by
     * an intentional user action (e.g. arrow-move reorder). This prevents background
     * renders — such as recurring task auto-creation — from re-opening task option
     * buttons that the user did not explicitly request.
     * @private
     */
    _restoreActiveTaskOptions() {
        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.()) return;

        const currentState = AppState.get();

        // Guard: only restore when an explicit user action requested it (one-shot flag).
        // Background renders (e.g. recurring task watcher) must not trigger this path.
        if (currentState?.ui?.shouldRestoreActiveTaskOptions !== true) return;

        const activeTaskId = currentState?.ui?.activeTaskId;

        if (!activeTaskId) {
            // Clear the flag even if there is no active task to restore
            this._clearRestoreFlag(AppState);
            return;
        }

        // Find the task element and show its options
        const taskElement = document.querySelector(DATA_SELECTORS.taskById(activeTaskId));
        if (taskElement) {
            // Directly show task options (don't use revealTaskButtons to avoid toggle behavior)
            const taskOptions = taskElement.querySelector(DOM_SELECTORS.TASK_OPTIONS);
            if (taskOptions) {
                taskOptions.classList.add(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
                taskOptions.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
                // Sync tabindex so restored buttons are keyboard-reachable
                taskOptions.querySelectorAll('button.task-btn').forEach(btn => {
                    btn.tabIndex = 0;
                });
            }
        }

        // Clear the one-shot flag after restoring so subsequent background renders
        // do not re-open the options.
        this._clearRestoreFlag(AppState);
    }

    /**
     * Clear the shouldRestoreActiveTaskOptions one-shot flag in AppState.
     * @param {Object} AppState - AppState instance
     * @private
     */
    _clearRestoreFlag(AppState) {
        AppState.update(state => {
            if (!state.ui) state.ui = {};
            state.ui.shouldRestoreActiveTaskOptions = false;
        }, false);
    }
}

// ============================================
// Global Instance Management
// ============================================

let taskRenderer = null;

/**
 * Initialize the global task renderer singleton.
 * Called by moduleLoader during Phase 2 boot.
 *
 * @param {Object} dependencies - Required dependencies
 * @param {MiniCycleState} [dependencies.AppState] - State manager
 * @param {Function} [dependencies.addTask] - Task creation function
 * @param {Function} [dependencies.loadMiniCycle] - Cycle loading function
 * @returns {TaskRenderer} The initialized renderer instance
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

// ES6 exports
export {
    renderTasks,
    refreshUIFromState,
    refreshTaskListUI
};
