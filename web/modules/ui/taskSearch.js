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

// ============================================================================
// CONSTANTS
// ============================================================================

const TASK_THRESHOLD = 3; // Show search when this many tasks exist

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskSearch', {
    getElementById: optional((id) => document.getElementById(id)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel))
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

    const container = deps.getElementById('task-search-container');
    const searchBtn = deps.getElementById('task-search-btn');
    const searchInput = deps.getElementById('task-search-input');
    const clearBtn = deps.getElementById('task-search-clear');

    if (!container || !searchBtn || !searchInput || !clearBtn) {
        console.warn('⚠️ TaskSearch: Required DOM elements not found');
        return;
    }

    // Toggle search input on button click
    searchBtn.addEventListener('click', () => {
        toggleSearchInput();
    });

    // Filter tasks as user types
    searchInput.addEventListener('input', (e) => {
        filterTasks(e.target.value);
    });

    // Clear search on X button click
    clearBtn.addEventListener('click', () => {
        clearSearch();
    });

    // Clear search on Escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
            collapseSearch();
        }
    });

    isInitialized = true;
    console.log('✅ TaskSearch initialized');

    // NOTE: Don't check initial task count here - tasks aren't rendered yet during boot
    // TaskRenderer will call updateSearchVisibility() after rendering tasks
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
    const searchBtn = deps.getElementById('task-search-btn');
    const searchInput = deps.getElementById('task-search-input');
    const clearBtn = deps.getElementById('task-search-clear');

    if (searchInput && clearBtn && searchBtn) {
        searchInput.style.display = 'block';
        clearBtn.style.display = 'block';
        searchBtn.classList.add('active');
        searchInput.focus();
        isSearchExpanded = true;
    }
}

/**
 * Collapse search input
 */
function collapseSearch() {
    const deps = di.resolve();
    const searchBtn = deps.getElementById('task-search-btn');
    const searchInput = deps.getElementById('task-search-input');
    const clearBtn = deps.getElementById('task-search-clear');

    if (searchInput && clearBtn && searchBtn) {
        searchInput.style.display = 'none';
        clearBtn.style.display = 'none';
        searchBtn.classList.remove('active');
        isSearchExpanded = false;
    }
}

/**
 * Clear search input and reset filter
 */
function clearSearch() {
    const deps = di.resolve();
    const searchInput = deps.getElementById('task-search-input');

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
    const tasks = deps.querySelectorAll('#taskList .task');
    const lowerQuery = query.toLowerCase().trim();

    tasks.forEach(task => {
        const taskText = task.querySelector('.task-text')?.textContent?.toLowerCase() || '';
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
    const container = deps.getElementById('task-search-container');

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
    const tasks = deps.querySelectorAll('#taskList .task');
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
