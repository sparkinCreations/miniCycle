/**
 * Task Search Module (DI-Pure)
 *
 * Provides inline task search/filter functionality:
 * - Shows search icon when 3+ tasks exist
 * - Expands to inline search input on click
 * - Filters tasks in real-time as user types
 * - Filter chips: All | Incomplete | Completed | Priority | Due Date | Recurring
 * - Sort chips: Default | A–Z | Priority First | Due Date
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
let currentFilter = 'all';        // persists across open/close
let currentSort = 'default';      // persists across open/close
let originalTaskOrder = null;     // array of task IDs captured before first non-default sort
let filterGroupCollapsed = true;  // filter chips show only active chip when true

// ============================================================================
// MODULE IMPLEMENTATION
// ============================================================================

/**
 * Initialize task search functionality
 * Sets up event listeners for search button, input, clear, filter chips, sort chips
 */
export function initTaskSearch() {
    if (isInitialized) return;

    const deps = di.resolve();

    const container = deps.getElementById(DOM_IDS.TASK_SEARCH_CONTAINER);
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const searchInput = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);
    const clearBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_CLEAR);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);
    const filterRow = deps.getElementById(DOM_IDS.TASK_FILTER_SORT_ROW);

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
        applyFiltersAndSort(e.target.value);
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

    // Filter chip click handlers — collapsed by default, expand on click, collapse after selection
    if (filterRow) {
        const filterChipGroup = filterRow.querySelector('.filter-chip-group');

        filterRow.querySelectorAll('.filter-chip').forEach(btn => {
            safeAdd(btn, 'click', () => {
                if (filterGroupCollapsed) {
                    // Expand to show all options — don't change filter yet
                    filterGroupCollapsed = false;
                    filterChipGroup?.classList.remove('collapsed');
                    filterChipGroup?.setAttribute('aria-expanded', 'true');
                    return;
                }

                // Expanded: set selected filter + collapse
                currentFilter = btn.dataset.filter;
                filterRow.querySelectorAll('.filter-chip').forEach(b => {
                    const selected = b === btn;
                    b.classList.toggle('active', selected);
                    b.setAttribute('aria-pressed', String(selected));
                });
                filterGroupCollapsed = true;
                filterChipGroup?.classList.add('collapsed');
                filterChipGroup?.setAttribute('aria-expanded', 'false');
                applyFiltersAndSort(searchInput.value || '');
            });
        });

        // Sort chip click handlers
        filterRow.querySelectorAll('.sort-chip').forEach(btn => {
            safeAdd(btn, 'click', () => {
                currentSort = btn.dataset.sort;
                // Reset captured order when going back to default (allow fresh capture next time)
                if (currentSort === 'default') {
                    originalTaskOrder = null;
                }
                filterRow.querySelectorAll('.sort-chip').forEach(b => {
                    const selected = b === btn;
                    b.classList.toggle('active', selected);
                    b.setAttribute('aria-pressed', String(selected));
                });
                applyFiltersAndSort(searchInput.value || '');
            });
        });
    }

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
 * Expand search input and filter/sort row
 */
function expandSearch() {
    const deps = di.resolve();
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const searchInput = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);
    const filterRow = deps.getElementById(DOM_IDS.TASK_FILTER_SORT_ROW);

    if (inputRow && searchBtn) {
        inputRow.classList.remove('hidden');
        filterRow?.classList.remove('hidden');
        searchBtn.classList.add('active');
        searchInput?.focus({ focusVisible: false });
        isSearchExpanded = true;
        // Re-apply current filter/sort in case tasks changed while closed
        applyFiltersAndSort(searchInput?.value || '');
    }
}

/**
 * Collapse search input and filter/sort row (keeps chip selections)
 */
function collapseSearch() {
    const deps = di.resolve();
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);
    const filterRow = deps.getElementById(DOM_IDS.TASK_FILTER_SORT_ROW);

    if (inputRow && searchBtn) {
        inputRow.classList.add('hidden');
        filterRow?.classList.add('hidden');
        searchBtn.classList.remove('active');
        isSearchExpanded = false;

        // Always re-collapse the filter group when search closes
        const filterChipGroup = filterRow?.querySelector('.filter-chip-group');
        if (filterChipGroup) {
            filterGroupCollapsed = true;
            filterChipGroup.classList.add('collapsed');
            filterChipGroup.setAttribute('aria-expanded', 'false');
        }
    }
}

/**
 * Clear search input and re-apply current filter/sort
 */
function clearSearch() {
    const deps = di.resolve();
    const searchInput = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);

    if (searchInput) {
        searchInput.value = '';
        applyFiltersAndSort('');
    }
}

/**
 * Check whether a task matches the current category filter
 * @param {HTMLElement} task - Task list item element
 * @returns {boolean}
 */
function matchesFilter(task) {
    if (currentFilter === 'all') return true;

    const checkbox = task.querySelector("input[type='checkbox']");

    if (currentFilter === 'incomplete') return !checkbox?.checked;
    if (currentFilter === 'completed')  return !!checkbox?.checked;
    if (currentFilter === 'priority')   return task.classList.contains('high-priority');
    if (currentFilter === 'due-date')   return !!(task.querySelector(DOM_SELECTORS.DUE_DATE)?.value);
    if (currentFilter === 'recurring')  {
        return task.querySelector(DOM_SELECTORS.RECURRING_BTN)?.classList.contains('active') ?? false;
    }

    return true;
}

/**
 * Re-order task DOM elements according to current sort.
 * Non-destructive: original order is captured on first non-default sort,
 * and restored when switching back to 'default'.
 * @param {HTMLElement[]} tasks - Current task elements (in current DOM order)
 * @param {HTMLElement} taskList - The <ul> task list element
 */
function applySortToDOM(tasks, taskList) {
    if (currentSort === 'default') {
        // Restore original DOM order if we have a saved order
        if (originalTaskOrder) {
            originalTaskOrder.forEach(id => {
                const el = taskList.querySelector(`[data-task-id="${id}"]`);
                if (el) taskList.appendChild(el);
            });
        }
        return;
    }

    // Capture original order the first time we apply a non-default sort
    if (!originalTaskOrder) {
        originalTaskOrder = tasks.map(t => t.dataset.taskId).filter(Boolean);
    }

    const sorted = [...tasks].sort((a, b) => {
        if (currentSort === 'az') {
            const ta = a.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '';
            const tb = b.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '';
            return ta.localeCompare(tb);
        }
        if (currentSort === 'priority') {
            const pa = a.classList.contains('high-priority') ? 0 : 1;
            const pb = b.classList.contains('high-priority') ? 0 : 1;
            return pa - pb;
        }
        if (currentSort === 'due-date') {
            const da = a.querySelector(DOM_SELECTORS.DUE_DATE)?.value || '9999-12-31';
            const db = b.querySelector(DOM_SELECTORS.DUE_DATE)?.value || '9999-12-31';
            return da.localeCompare(db);
        }
        return 0;
    });

    sorted.forEach(el => taskList.appendChild(el));
}

/**
 * Apply both text search and category filter + sort to the task list.
 * @param {string} query - Current text search query
 */
function applyFiltersAndSort(query) {
    const deps = di.resolve();
    const taskList = deps.getElementById(DOM_IDS.TASK_LIST);
    if (!taskList) return;

    const tasks = [...taskList.querySelectorAll(DOM_SELECTORS.TASK)];
    const lowerQuery = query.toLowerCase().trim();

    // 1. Apply sort (reorders DOM nodes)
    applySortToDOM(tasks, taskList);

    // 2. Apply text + category filter (show/hide each task)
    const orderedTasks = [...taskList.querySelectorAll(DOM_SELECTORS.TASK)];
    orderedTasks.forEach(task => {
        const taskText = task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '';
        const textMatch = lowerQuery === '' || taskText.includes(lowerQuery);
        const categoryMatch = matchesFilter(task);
        task.style.display = (textMatch && categoryMatch) ? '' : 'none';
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
 * Reset search state (called when switching routines).
 * Restores original DOM task order and resets all chips to defaults.
 */
export function resetSearch() {
    const deps = di.resolve();

    // Restore original DOM order if tasks were sorted
    if (originalTaskOrder) {
        const taskList = deps.getElementById(DOM_IDS.TASK_LIST);
        if (taskList) {
            originalTaskOrder.forEach(id => {
                const el = taskList.querySelector(`[data-task-id="${id}"]`);
                if (el) taskList.appendChild(el);
            });
        }
        originalTaskOrder = null;
    }

    // Reset filter/sort state
    currentFilter = 'all';
    currentSort = 'default';
    filterGroupCollapsed = true;

    // Reset chip visual state to defaults
    const filterRow = deps.getElementById(DOM_IDS.TASK_FILTER_SORT_ROW);
    if (filterRow) {
        filterRow.querySelectorAll('.filter-chip').forEach(b => {
            const isAll = b.dataset.filter === 'all';
            b.classList.toggle('active', isAll);
            b.setAttribute('aria-pressed', String(isAll));
        });
        filterRow.querySelectorAll('.sort-chip').forEach(b => {
            const isDef = b.dataset.sort === 'default';
            b.classList.toggle('active', isDef);
            b.setAttribute('aria-pressed', String(isDef));
        });
        // Re-collapse the filter chip group
        const filterChipGroup = filterRow.querySelector('.filter-chip-group');
        if (filterChipGroup) {
            filterChipGroup.classList.add('collapsed');
            filterChipGroup.setAttribute('aria-expanded', 'false');
        }
    }

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
