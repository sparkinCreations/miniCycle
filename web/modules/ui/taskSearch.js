/**
 * Task Search Module (DI-Pure)
 *
 * Provides inline task search/filter functionality:
 * - Shows search icon when 3+ tasks exist
 * - Expands to inline search input on click
 * - Filters tasks in real-time as user types
 *
 * @module modules/ui/taskSearch
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const TASK_THRESHOLD = 3; // Show search when this many tasks exist

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskSearch', {
    getElementById: optional((id) => document.getElementById(id)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    safeAddEventListener: optional(null)
});

/**
 * Set dependencies for TaskSearch module
 * @param {Object} dependencies - Injected dependencies
 */
export const setTaskSearchDependencies = (dependencies) => di.setDependencies(dependencies);

// ============================================================================
// MODULE STATE
// ============================================================================

let isSearchExpanded = false;
let isInitialized = false;

// ============================================================================
// MODULE IMPLEMENTATION
// ============================================================================

/**
 * Initialize task search functionality
 * Sets up event listeners for search button, input, and clear
 */
export function initTaskSearch() {
    if (isInitialized) return;

    const deps = di.resolve();

    const container = deps.getElementById(DOM_IDS.TASK_SEARCH_CONTAINER);
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const searchInput = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);
    const clearBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_CLEAR);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);

    if (!container || !searchBtn || !searchInput || !clearBtn || !inputRow) {
        console.warn('⚠️ TaskSearch: Required DOM elements not found');
        return;
    }

    const safeAdd = deps.safeAddEventListener || ((el, evt, fn) => el.addEventListener(evt, fn));

    // Toggle search input on button click
    safeAdd(searchBtn, 'click', () => {
        toggleSearchInput();
    });

    // Filter tasks as user types
    safeAdd(searchInput, 'input', (e) => {
        filterTasks(e.target.value);
    });

    // Clear search on X button click - collapse if already empty
    safeAdd(clearBtn, 'click', () => {
        if (searchInput.value.trim() === '') {
            collapseSearch();
        } else {
            clearSearch();
        }
    });

    // Clear search on Escape key
    safeAdd(searchInput, 'keydown', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
            collapseSearch();
        }
    });

    isInitialized = true;
    console.log('✅ TaskSearch initialized');

    // Check initial task count - tasks are already rendered by coreBoot before this runs
    const initialCount = getTaskCount();
    updateSearchVisibility(initialCount);
}

/**
 * Toggle search input visibility
 */
function toggleSearchInput() {
    if (isSearchExpanded) {
        collapseSearch();
    } else {
        expandSearch();
    }
}

/**
 * Expand search input
 */
function expandSearch() {
    const deps = di.resolve();
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const searchInput = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);

    if (inputRow && searchBtn) {
        inputRow.classList.remove('hidden');
        searchBtn.classList.add('active');
        searchInput?.focus({ focusVisible: false });
        isSearchExpanded = true;
    }
}

/**
 * Collapse search input
 */
function collapseSearch() {
    const deps = di.resolve();
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);

    if (inputRow && searchBtn) {
        inputRow.classList.add('hidden');
        searchBtn.classList.remove('active');
        isSearchExpanded = false;
    }
}

/**
 * Clear search input and reset filter
 */
function clearSearch() {
    const deps = di.resolve();
    const searchInput = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);

    if (searchInput) {
        searchInput.value = '';
        filterTasks('');
    }
}

/**
 * Filter tasks based on search query
 * @param {string} query - Search query string
 */
function filterTasks(query) {
    const deps = di.resolve();
    const tasks = deps.querySelectorAll(`#${DOM_IDS.TASK_LIST} ${DOM_SELECTORS.TASK}`);
    const lowerQuery = query.toLowerCase().trim();

    tasks.forEach(task => {
        const taskText = task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '';
        const matches = lowerQuery === '' || taskText.includes(lowerQuery);
        task.style.display = matches ? '' : 'none';
    });
}

/**
 * Update search visibility based on task count
 * Called after tasks are rendered
 * @param {number} taskCount - Number of tasks in the list
 */
export function updateSearchVisibility(taskCount) {
    const deps = di.resolve();
    const container = deps.getElementById(DOM_IDS.TASK_SEARCH_CONTAINER);

    if (!container) return;

    if (taskCount >= TASK_THRESHOLD) {
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
        // Reset search state when hidden
        if (isSearchExpanded) {
            clearSearch();
            collapseSearch();
        }
    }
}

/**
 * Get current task count from DOM
 * @returns {number} Number of tasks
 */
export function getTaskCount() {
    const deps = di.resolve();
    const tasks = deps.querySelectorAll(`#${DOM_IDS.TASK_LIST} ${DOM_SELECTORS.TASK}`);
    return tasks.length;
}

/**
 * Reset search state (useful when switching routines)
 */
export function resetSearch() {
    clearSearch();
    collapseSearch();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTaskSearch);
} else {
    // DOM already loaded, initialize immediately
    initTaskSearch();
}

console.log('📦 TaskSearch module loaded');
