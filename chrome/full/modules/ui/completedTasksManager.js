/**
 * miniCycle Completed Tasks Manager
 *
 * Manages the collapsible completed tasks section that optionally separates
 * completed tasks from active tasks in the UI.
 *
 * Responsibilities:
 * - Section initialization and state restoration
 * - Toggle visibility (expand/collapse with state persistence)
 * - Moving tasks between active and completed lists
 * - Organizing tasks on cycle load
 * - Completed task count updates
 *
 * @module ui/completedTasksManager
 * @version 1.0.0
 * @see {@link module:task/taskCompletion} - Task completion handling
 */

/**
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('CompletedTasksManager', {
    AppState: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    getActiveElement: optional(() => document.activeElement),
    safeAddEventListener: optional((el, evt, fn) => { el?.removeEventListener(evt, fn); el?.addEventListener(evt, fn); })
});

/**
 * Set dependencies for CompletedTasksManager (call before creating instance)
 * @param {Object} dependencies - { AppState, getElementById, querySelector, safeAddEventListener }
 */
export function setCompletedTasksManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages the completed tasks dropdown, including rendering, toggling visibility,
 * and handling completed task interactions.
 */
export class CompletedTasksManager {
    constructor(dependencies = {}) {

        // Resolve deps from diBase, with constructor overrides
        this.deps = di.resolve(dependencies);

        this._initialized = false;
    }

    /**
     * Initialize completed tasks section
     * Sets up event listeners and restores saved state
     */
    init() {
        // ✅ Idempotency guard
        if (this._initialized) {
            return;
        }

        const header = this.deps.getElementById(DOM_IDS.COMPLETED_TASKS_HEADER);
        const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);

        if (!header || !completedList) {
            console.warn('⚠️ CompletedTasksManager: Completed tasks elements not found');
            return;
        }

        // Add click handler for toggling
        this.deps.safeAddEventListener(header, 'click', () => this.toggle());

        // Restore saved collapsed state
        this.restoreState();

        // Update count on page load
        this.updateCount();

        this._initialized = true;
    }

    /**
     * Toggle the completed tasks section visibility
     */
    toggle() {
        const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
        const toggleIcon = this.deps.querySelector(`#${DOM_IDS.COMPLETED_TASKS_HEADER} ${DOM_SELECTORS.TOGGLE_ICON}`);

        if (!completedList || !toggleIcon) return;

        const isVisible = completedList.classList.toggle(DOM_CLASSES.VISIBLE);
        toggleIcon.textContent = isVisible ? '▲' : '▼';

        // Update aria-expanded on header
        const header = this.deps.getElementById(DOM_IDS.COMPLETED_TASKS_HEADER);
        if (header) header.setAttribute('aria-expanded', String(isVisible));

        // Save preference to AppState
        const AppState = this.deps.AppState;
        if (AppState?.isReady?.()) {
            AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.completedTasksExpanded = isVisible;
            }, true);
        }

    }

    /**
     * Restore completed tasks section state from AppState
     */
    restoreState() {
        const AppState = this.deps.AppState;
        if (!AppState?.isReady?.()) return;

        const state = AppState.get();
        const isExpanded = state?.settings?.completedTasksExpanded || false;

        const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
        const toggleIcon = this.deps.querySelector(`#${DOM_IDS.COMPLETED_TASKS_HEADER} ${DOM_SELECTORS.TOGGLE_ICON}`);

        if (completedList && toggleIcon) {
            if (isExpanded) {
                completedList.classList.add(DOM_CLASSES.VISIBLE);
                toggleIcon.textContent = '▲';
            } else {
                completedList.classList.remove(DOM_CLASSES.VISIBLE);
                toggleIcon.textContent = '▼';
            }

            // Update aria-expanded on header
            const header = this.deps.getElementById(DOM_IDS.COMPLETED_TASKS_HEADER);
            if (header) header.setAttribute('aria-expanded', String(isExpanded));
        }
    }

    /**
     * Move a task to the completed list
     * @param {HTMLElement} taskElement - The task element to move
     * @returns {void}
     */
    moveToCompleted(taskElement) {
        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
        const completedSection = this.deps.getElementById(DOM_IDS.COMPLETED_TASKS_SECTION);

        if (!completedList || !completedSection || !taskElement) return;

        // Store original position before moving (for restoration on uncomplete)
        if (taskList) {
            const siblings = Array.from(taskList.querySelectorAll(DOM_SELECTORS.TASK));
            const currentIndex = siblings.indexOf(taskElement);
            if (currentIndex !== -1) {
                taskElement.dataset.originalIndex = currentIndex;
            }
        }

        // Prep the node (clear stale classes, hide options, disable dragging)
        this.prepareCompletedNode(taskElement);

        // Move the task element
        completedList.appendChild(taskElement);

        // Show the completed section if it has tasks
        completedSection.classList.add(DOM_CLASSES.SHOW);

        // Update count and boundary markers
        this.updateCount();
        this._updateBoundaryMarkers();
    }

    /**
     * Apply the node-level prep a completed task needs to live in the dropdown: clear stale
     * interaction classes, hide its options, and disable dragging. Shared by moveToCompleted()
     * (runtime move) and the renderer's partitioned render (render-path unification), so both
     * paths produce identically-prepped completed nodes.
     * @param {HTMLElement} taskElement
     * @returns {void}
     */
    prepareCompletedNode(taskElement) {
        if (!taskElement) return;
        this._cleanupTaskStateBeforeMove(taskElement);
        taskElement.setAttribute('draggable', 'false');
    }

    /**
     * Move a task back to the active list at its original position
     * @param {HTMLElement} taskElement - The task element to move
     * @returns {void}
     */
    moveToActive(taskElement) {
        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);

        if (!taskList || !taskElement) return;

        // Clear stale interaction classes before moving
        this._cleanupTaskStateBeforeMove(taskElement);

        // Restore draggable attribute for active list
        taskElement.setAttribute('draggable', 'true');

        // Save current focus state — restore after DOM move
        const hadFocus = taskElement.contains(this.deps.getActiveElement());

        // Try to restore to original position (saved when task was completed)
        const originalIndex = parseInt(taskElement.dataset.originalIndex, 10);
        const currentTaskEls = Array.from(taskList.querySelectorAll(DOM_SELECTORS.TASK));

        if (!isNaN(originalIndex) && originalIndex >= 0) {
            // Clamp to valid range (list may have fewer tasks now)
            const insertIndex = Math.min(originalIndex, currentTaskEls.length);

            if (insertIndex < currentTaskEls.length) {
                taskList.insertBefore(taskElement, currentTaskEls[insertIndex]);
            } else {
                taskList.appendChild(taskElement);
            }

            // Clean up the stored index
            delete taskElement.dataset.originalIndex;
        } else {
            // Fallback: append to end if no original position stored
            taskList.appendChild(taskElement);
        }

        // Restore focus to the task if it had it before the move
        if (hadFocus) {
            const taskLabel = taskElement.querySelector(DOM_SELECTORS.TASK_TEXT);
            if (taskLabel) {
                taskLabel.focus();
            } else {
                taskElement.focus();
            }
        }

        // Update count and boundary markers
        this.updateCount();
        this._updateBoundaryMarkers();
    }

    /**
     * Update the completed tasks count display
     */
    updateCount() {
        const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
        const completedCount = this.deps.getElementById(DOM_IDS.COMPLETED_COUNT);
        const completedSection = this.deps.getElementById(DOM_IDS.COMPLETED_TASKS_SECTION);

        if (!completedList || !completedCount || !completedSection) return;

        const count = completedList.children.length;
        completedCount.textContent = count;

        // Hide section if no completed tasks
        if (count === 0) {
            completedSection.classList.remove(DOM_CLASSES.SHOW);
        } else {
            completedSection.classList.add(DOM_CLASSES.SHOW);
        }
    }

    /**
     * Clear stale interaction classes from a task before moving it between lists.
     * Prevents ghost buttons, stale drag state, and incorrect boundary markers.
     * @param {HTMLElement} taskElement - The task element being moved
     * @private
     */
    _cleanupTaskStateBeforeMove(taskElement) {
        taskElement.classList.remove(
            DOM_CLASSES.LONG_PRESSED,
            DOM_CLASSES.DRAGGING,
            DOM_CLASSES.IS_FIRST_TASK,
            DOM_CLASSES.IS_LAST_TASK
        );

        // Reset task options visibility to default (hidden until hover/tap)
        const taskOptions = taskElement.querySelector(DOM_SELECTORS.TASK_OPTIONS);
        if (taskOptions) {
            taskOptions.classList.remove(DOM_CLASSES.TASK_OPTIONS_VISIBLE);
            taskOptions.classList.add(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN);
        }
    }

    /**
     * Update first/last task boundary markers on the active list.
     * Called after tasks move between lists to ensure arrow visibility is correct.
     * @private
     */
    _updateBoundaryMarkers() {
        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) return;

        // Remove old markers
        taskList.querySelector(DOM_SELECTORS.IS_FIRST_TASK)?.classList.remove(DOM_CLASSES.IS_FIRST_TASK);
        taskList.querySelector(DOM_SELECTORS.IS_LAST_TASK)?.classList.remove(DOM_CLASSES.IS_LAST_TASK);

        // Find first/last incomplete tasks (skip completed — their arrows are hidden)
        const tasks = Array.from(taskList.children).filter(el =>
            el.classList.contains(DOM_CLASSES.TASK) && !el.querySelector(DOM_SELECTORS.TASK_INPUT_CHECKED)
        );

        const firstTask = tasks[0] || null;
        const lastTask = tasks.length > 1 ? tasks[tasks.length - 1] : null;

        if (firstTask) {
            firstTask.classList.add(DOM_CLASSES.IS_FIRST_TASK);
        }
        if (lastTask && lastTask !== firstTask) {
            lastTask.classList.add(DOM_CLASSES.IS_LAST_TASK);
        }
    }

    /**
     * Handle task completion/un-completion to move between lists
     * This should be called after the checkbox state changes
     * @param {HTMLElement} taskElement - The task element
     * @param {boolean} isCompleted - Whether the task is completed
     */
    handleMovement(taskElement, isCompleted) {
        if (!taskElement) return;

        // Check if completed dropdown feature is enabled
        if (!this.isEnabled()) {
            return; // Feature disabled, keep tasks in main list
        }

        if (isCompleted) {
            this.moveToCompleted(taskElement);
        } else {
            this.moveToActive(taskElement);
        }
    }

    /**
     * Check if the completed dropdown feature is enabled
     * @returns {boolean} - True if enabled, false otherwise
     */
    isEnabled() {
        // Check AppState first
        const AppState = this.deps.AppState;
        if (AppState?.isReady?.()) {
            const state = AppState.get();
            return state?.settings?.showCompletedDropdown || false;
        }

        // Fallback to checkbox state
        const toggle = this.deps.getElementById(DOM_IDS.TOGGLE_COMPLETED_DROPDOWN);
        return toggle ? toggle.checked : false;
    }

    /**
     * Reconcile the active list and the completed dropdown against checkbox state.
     * Runs on cycle load and after undo/redo. Bidirectional: completed tasks in the
     * active list move DOWN to the completed section, and un-completed tasks in the
     * completed section move back UP to the active list.
     *
     * The up-direction is essential for undo/redo: un-completing a task is a *patch*
     * render, which updates the checkbox in place but does NOT relocate the DOM node.
     * Without moving it back, the task is left stranded — unchecked yet still sitting
     * in the completed dropdown (the UI fails to reflect the undo).
     */
    organize() {
        // Check if feature is enabled first
        if (!this.isEnabled()) {
            return;
        }

        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) return;

        const completedList = this.deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);

        // DEDUPE: a full re-render (renderTasks → replaceChildren) regenerates every
        // task as a fresh node in the active list but leaves the completed list
        // untouched. Any completed-list node whose task now also has a fresh node in
        // the active list is a stale duplicate — drop it before the DOWN pass below
        // re-appends the fresh copy (otherwise the completed dropdown shows two of each).
        // No-op in steady state and for undo/redo callers, where a completed task lives
        // only in the completed list and has no active-list counterpart.
        if (completedList) {
            const activeIds = new Set(
                Array.from(taskList.querySelectorAll(DOM_SELECTORS.TASK))
                    .map(el => el.dataset.taskId)
                    .filter(Boolean)  // a missing id must never count as a match
            );
            Array.from(completedList.querySelectorAll(DOM_SELECTORS.TASK)).forEach(el => {
                if (el.dataset.taskId && activeIds.has(el.dataset.taskId)) {
                    el.remove();
                }
            });
        }

        // DOWN: move each completed task in the active list to the completed section.
        Array.from(taskList.querySelectorAll(DOM_SELECTORS.TASK)).forEach(taskElement => {
            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
                this.moveToCompleted(taskElement);
            }
        });

        // UP: move any now-uncompleted task in the completed section back to the
        // active list (restores its original position via moveToActive()).
        if (completedList) {
            Array.from(completedList.querySelectorAll(DOM_SELECTORS.TASK)).forEach(taskElement => {
                const checkbox = taskElement.querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                    this.moveToActive(taskElement);
                }
            });
        }

        // Refresh count/visibility — the dedupe pass above may have removed the last
        // completed node without any subsequent move() to update the count.
        this.updateCount();
    }
}

// DI-pure module (no window.* fallbacks for dependencies)

/**
 * Initialize and return a configured CompletedTasksManager instance
 * @param {Object} dependencies - Optional constructor dependencies
 * @returns {CompletedTasksManager} Configured instance
 */
export async function initCompletedTasksManager(dependencies = {}) {
    // Pass dependencies directly (no adapter needed with new pattern)
    const adaptedDeps = {
        AppState: dependencies.AppState,
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel),
        querySelectorAll: (sel) => document.querySelectorAll(sel),
        safeAddEventListener: dependencies.safeAddEventListener
    };

    const manager = new CompletedTasksManager(adaptedDeps);
    manager.init();
    return manager;
}
