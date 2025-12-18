/**
 * Completed Tasks Manager (DI-Pure)
 * Manages the completed tasks dropdown section
 *
 * Handles:
 * - Completed tasks section initialization
 * - Toggle visibility (expand/collapse)
 * - Moving tasks between active and completed lists
 * - Organizing tasks on cycle load
 * - Count updates
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('CompletedTasksManager', {
    getAppState: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    safeAddEventListener: optional((el, evt, fn) => el?.addEventListener(evt, fn))
});

/**
 * Set dependencies for CompletedTasksManager (call before creating instance)
 * @param {Object} dependencies - { getAppState, getElementById, querySelector, safeAddEventListener }
 */
export function setCompletedTasksManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎯 CompletedTasksManager dependencies set:', Object.keys(dependencies));
}

export class CompletedTasksManager {
    constructor(dependencies = {}) {
        console.log('🎯 CompletedTasksManager: Constructing with dependencies');

        // Resolve deps from diBase, with constructor overrides
        this.deps = di.resolve(dependencies);

        this.isInitialized = false;
    }

    /**
     * Initialize completed tasks section
     * Sets up event listeners and restores saved state
     */
    init() {
        console.log('🎯 CompletedTasksManager: Initializing completed tasks section...');

        const header = this.deps.getElementById('completed-tasks-header');
        const completedList = this.deps.getElementById('completedTaskList');

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

        this.isInitialized = true;
        console.log('✅ CompletedTasksManager: Completed tasks section initialized');
    }

    /**
     * Toggle the completed tasks section visibility
     */
    toggle() {
        const completedList = this.deps.getElementById('completedTaskList');
        const toggleIcon = this.deps.querySelector('#completed-tasks-header .toggle-icon');

        if (!completedList || !toggleIcon) return;

        const isVisible = completedList.classList.toggle('visible');
        toggleIcon.textContent = isVisible ? '▲' : '▼';

        // Save preference to AppState
        const AppState = this.deps.getAppState();
        if (AppState?.isReady?.()) {
            AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.completedTasksExpanded = isVisible;
            }, true);
        }

        console.log(`✅ CompletedTasksManager: Completed tasks section ${isVisible ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Restore completed tasks section state from AppState
     */
    restoreState() {
        const AppState = this.deps.getAppState();
        if (!AppState?.isReady?.()) return;

        const state = AppState.get();
        const isExpanded = state?.settings?.completedTasksExpanded || false;

        const completedList = this.deps.getElementById('completedTaskList');
        const toggleIcon = this.deps.querySelector('#completed-tasks-header .toggle-icon');

        if (completedList && toggleIcon) {
            if (isExpanded) {
                completedList.classList.add('visible');
                toggleIcon.textContent = '▲';
            } else {
                completedList.classList.remove('visible');
                toggleIcon.textContent = '▼';
            }
        }
    }

    /**
     * Move a task to the completed list
     * @param {HTMLElement} taskElement - The task element to move
     */
    moveToCompleted(taskElement) {
        const completedList = this.deps.getElementById('completedTaskList');
        const completedSection = this.deps.getElementById('completed-tasks-section');

        if (!completedList || !completedSection || !taskElement) return;

        // Move the task element
        completedList.appendChild(taskElement);

        // Show the completed section if it has tasks
        completedSection.style.display = 'block';

        // Update count
        this.updateCount();

        console.log('✅ CompletedTasksManager: Task moved to completed section');
    }

    /**
     * Move a task back to the active list
     * @param {HTMLElement} taskElement - The task element to move
     */
    moveToActive(taskElement) {
        const taskList = this.deps.getElementById('taskList');

        if (!taskList || !taskElement) return;

        // Move the task element back to the top of active list
        taskList.insertBefore(taskElement, taskList.firstChild);

        // Update count
        this.updateCount();

        console.log('✅ CompletedTasksManager: Task moved back to active list');
    }

    /**
     * Update the completed tasks count display
     */
    updateCount() {
        const completedList = this.deps.getElementById('completedTaskList');
        const completedCount = this.deps.getElementById('completed-count');
        const completedSection = this.deps.getElementById('completed-tasks-section');

        if (!completedList || !completedCount || !completedSection) return;

        const count = completedList.children.length;
        completedCount.textContent = count;

        // Hide section if no completed tasks
        if (count === 0) {
            completedSection.style.display = 'none';
        } else {
            completedSection.style.display = 'block';
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
        const AppState = this.deps.getAppState();
        if (AppState?.isReady?.()) {
            const state = AppState.get();
            return state?.settings?.showCompletedDropdown || false;
        }

        // Fallback to checkbox state
        const toggle = this.deps.getElementById('toggle-completed-dropdown');
        return toggle ? toggle.checked : false;
    }

    /**
     * Organize all completed tasks when loading a cycle
     * Scans the main task list and moves completed tasks to the completed section
     */
    organize() {
        // Check if feature is enabled first
        if (!this.isEnabled()) {
            console.log('⏭️ CompletedTasksManager: Completed dropdown disabled, skipping organization');
            return;
        }

        const taskList = this.deps.getElementById('taskList');
        if (!taskList) return;

        console.log('🔄 CompletedTasksManager: Organizing completed tasks on load...');

        // Get all tasks in the main list
        const tasks = Array.from(taskList.querySelectorAll('.task'));

        // Move each completed task to the completed section
        tasks.forEach(taskElement => {
            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
                this.moveToCompleted(taskElement);
            }
        });

        console.log(`✅ CompletedTasksManager: Organized ${taskList.querySelectorAll('.task').length} active and completed tasks`);
    }
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('🎯 CompletedTasksManager module loaded (DI-pure, no window.* exports)');

/**
 * Initialize and return a configured CompletedTasksManager instance
 * @param {Object} dependencies - Optional constructor dependencies
 * @returns {CompletedTasksManager} Configured instance
 */
export async function initCompletedTasksManager(dependencies = {}) {
    // Adapt moduleLoader dependencies to getter pattern expected by this module
    const adaptedDeps = {
        getAppState: () => dependencies.AppState,
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel),
        querySelectorAll: (sel) => document.querySelectorAll(sel),
        safeAddEventListener: dependencies.safeAddEventListener || dependencies.GlobalUtils?.safeAddEventListener
    };

    const manager = new CompletedTasksManager(adaptedDeps);
    manager.init();
    console.log('✅ CompletedTasksManager initialized via initCompletedTasksManager');
    return manager;
}
