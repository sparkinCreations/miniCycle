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
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS } from '../core/constants.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const TASK_THRESHOLD = 3; // Show search when this many tasks exist

/** @returns {boolean} True on touch-primary devices (phones/tablets) */
function _isMobileTouch() {
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0)
        && window.matchMedia('(pointer: coarse)').matches;
}

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('TaskSearch', {
    getElementById: optional((id) => document.getElementById(id)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    getBody: optional(() => document.body),
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
let _pageOverlay = null;          // mobile-only: full-page edit-focus overlay
let _innerOverlay = null;         // mobile-only: inner overlay inside task list container
let _searchOverlayDismissTimer = null; // debounce overlay removal on blur → refocus

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

    // Mobile: show overlay when search input is focused (keyboard visible)
    // Dims everything behind the search bar for a focused search experience
    safeAdd(searchInput, 'focus', () => {
        if (_isMobileTouch()) {
            // Cancel pending dismiss if focus returned quickly (e.g., after chip tap)
            if (_searchOverlayDismissTimer) {
                clearTimeout(_searchOverlayDismissTimer);
                _searchOverlayDismissTimer = null;
            }
            _showSearchOverlay();
        }
    });

    safeAdd(searchInput, 'blur', () => {
        if (_isMobileTouch()) {
            // Delay overlay removal — if the user tapped a filter/sort chip,
            // focus will return to the input shortly. Without this delay the
            // overlay would flash off and back on.
            _searchOverlayDismissTimer = setTimeout(() => {
                _searchOverlayDismissTimer = null;
                _hideSearchOverlay();
            }, 150);
        }
    });

    // Filter chip click handlers — collapsed by default, expand on click, collapse after selection
    if (filterRow) {
        const filterChipGroup = filterRow.querySelector(DOM_SELECTORS.FILTER_CHIP_GROUP);

        filterRow.querySelectorAll(DOM_SELECTORS.FILTER_CHIP).forEach(btn => {
            safeAdd(btn, 'click', () => {
                if (filterGroupCollapsed) {
                    // Expand to show all options — don't change filter yet
                    filterGroupCollapsed = false;
                    filterChipGroup?.classList.remove(DOM_CLASSES.COLLAPSED);
                    filterChipGroup?.setAttribute('aria-expanded', 'true');
                    return;
                }

                // Expanded: set selected filter + collapse
                currentFilter = btn.dataset.filter;
                filterRow.querySelectorAll(DOM_SELECTORS.FILTER_CHIP).forEach(b => {
                    const selected = b === btn;
                    b.classList.toggle(DOM_CLASSES.ACTIVE, selected);
                    b.setAttribute('aria-pressed', String(selected));
                });
                filterGroupCollapsed = true;
                filterChipGroup?.classList.add(DOM_CLASSES.COLLAPSED);
                filterChipGroup?.setAttribute('aria-expanded', 'false');
                applyFiltersAndSort(searchInput.value || '');
            });
        });

        // Sort chip click handlers — clicking an active non-default chip toggles back to Default
        const defaultSortChip = filterRow.querySelector(`${DOM_SELECTORS.SORT_CHIP}[data-sort="default"]`);
        filterRow.querySelectorAll(DOM_SELECTORS.SORT_CHIP).forEach(btn => {
            safeAdd(btn, 'click', () => {
                const isAlreadyActive = btn.classList.contains(DOM_CLASSES.ACTIVE);
                const targetChip = (isAlreadyActive && btn.dataset.sort !== 'default') ? defaultSortChip : btn;

                currentSort = targetChip.dataset.sort;
                // Do NOT clear originalTaskOrder here. This used to null it
                // before applyFiltersAndSort ran, and applySortToDOM's restore
                // is guarded by `if (originalTaskOrder)` — so pressing Default
                // destroyed the order it was about to restore and simply left
                // the last sort's DOM order in place. applySortToDOM clears it
                // itself, AFTER restoring (resetSearch() has always done it in
                // that order).
                filterRow.querySelectorAll(DOM_SELECTORS.SORT_CHIP).forEach(b => {
                    const selected = b === targetChip;
                    b.classList.toggle(DOM_CLASSES.ACTIVE, selected);
                    b.setAttribute('aria-pressed', String(selected));
                });
                applyFiltersAndSort(searchInput.value || '');
            });
        });
    }

    isInitialized = true;

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
        inputRow.classList.remove(DOM_CLASSES.HIDDEN);
        filterRow?.classList.remove(DOM_CLASSES.HIDDEN);
        searchBtn.classList.add(DOM_CLASSES.ACTIVE);
        isSearchExpanded = true;

        // Mobile: don't auto-focus — let user tap the search bar to bring up keyboard.
        // Desktop: focus immediately for keyboard-first workflow.
        if (!_isMobileTouch()) {
            searchInput?.focus({ focusVisible: false });
        }

        // Re-apply current filter/sort in case tasks changed while closed
        applyFiltersAndSort(searchInput?.value || '');
    }
}

/**
 * Show edit-focus overlays behind the search bar on mobile.
 * Reuses the same two-overlay pattern as taskCRUD inline editing:
 *   1. Full-page overlay dims the entire app
 *   2. Inner overlay dims non-search content within the task card
 *   3. Search input row is raised as edit-focus-target
 */
function _showSearchOverlay() {
    if (_pageOverlay) return;

    const deps = di.resolve();
    const body = deps.getBody();
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);
    const taskView = inputRow?.closest('#' + DOM_IDS.TASK_VIEW);
    const taskListContainer = inputRow?.closest(DOM_SELECTORS.TASK_LIST_CONTAINER);

    // 1. Full-page overlay
    _pageOverlay = document.createElement('div');
    _pageOverlay.className = `${DOM_CLASSES.EDIT_FOCUS_OVERLAY} ${DOM_CLASSES.SEARCH_PAGE_OVERLAY}`;
    // Tapping the overlay blurs the input (dismisses keyboard + overlays)
    _pageOverlay._clickHandler = () => {
        deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT)?.blur();
    };
    _pageOverlay.addEventListener('click', _pageOverlay._clickHandler);
    body.appendChild(_pageOverlay);

    // 2. Raise task-view above the page overlay
    if (taskView) taskView.classList.add(DOM_CLASSES.EDIT_FOCUS_RAISED);

    // 3. Inner overlay inside the task list container
    if (taskListContainer) {
        _innerOverlay = document.createElement('div');
        _innerOverlay.className = `${DOM_CLASSES.EDIT_FOCUS_OVERLAY} ${DOM_CLASSES.EDIT_FOCUS_INNER}`;
        taskListContainer.appendChild(_innerOverlay);
    }

    // 4. Raise search input row above inner overlay
    inputRow?.classList.add(DOM_CLASSES.EDIT_FOCUS_TARGET);

    // Double rAF for smooth fade-in (matches taskCRUD pattern)
    requestAnimationFrame(() => requestAnimationFrame(() => {
        _pageOverlay?.classList.add(DOM_CLASSES.EDIT_FOCUS_ACTIVE);
        _innerOverlay?.classList.add(DOM_CLASSES.EDIT_FOCUS_ACTIVE);
    }));
}

/**
 * Remove edit-focus overlays for mobile search
 */
function _hideSearchOverlay() {
    if (_searchOverlayDismissTimer) {
        clearTimeout(_searchOverlayDismissTimer);
        _searchOverlayDismissTimer = null;
    }

    if (!_pageOverlay) return;

    const deps = di.resolve();
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);
    const taskView = inputRow?.closest('#' + DOM_IDS.TASK_VIEW);

    // Remove target highlight
    inputRow?.classList.remove(DOM_CLASSES.EDIT_FOCUS_TARGET);

    // Remove raised state from task-view
    if (taskView) taskView.classList.remove(DOM_CLASSES.EDIT_FOCUS_RAISED);

    // Remove inner overlay
    if (_innerOverlay) {
        _innerOverlay.remove();
        _innerOverlay = null;
    }

    // Remove page overlay
    _pageOverlay.removeEventListener('click', _pageOverlay._clickHandler);
    _pageOverlay.remove();
    _pageOverlay = null;
}

/**
 * Collapse search input and filter/sort row (keeps chip selections)
 */
function collapseSearch() {
    _hideSearchOverlay();

    const deps = di.resolve();
    const searchBtn = deps.getElementById(DOM_IDS.TASK_SEARCH_BTN);
    const inputRow = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT_ROW);
    const filterRow = deps.getElementById(DOM_IDS.TASK_FILTER_SORT_ROW);

    if (inputRow && searchBtn) {
        inputRow.classList.add(DOM_CLASSES.HIDDEN);
        filterRow?.classList.add(DOM_CLASSES.HIDDEN);
        searchBtn.classList.remove(DOM_CLASSES.ACTIVE);
        isSearchExpanded = false;

        // Always re-collapse the filter group when search closes
        const filterChipGroup = filterRow?.querySelector(DOM_SELECTORS.FILTER_CHIP_GROUP);
        if (filterChipGroup) {
            filterGroupCollapsed = true;
            filterChipGroup.classList.add(DOM_CLASSES.COLLAPSED);
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

    const checkbox = task.querySelector(DOM_SELECTORS.TASK_CHECKBOX);

    if (currentFilter === 'incomplete') return !checkbox?.checked;
    if (currentFilter === 'completed')  return !!checkbox?.checked;
    if (currentFilter === 'priority')   return task.classList.contains(DOM_CLASSES.HIGH_PRIORITY);
    if (currentFilter === 'due-date')   return !!(task.querySelector(DOM_SELECTORS.DUE_DATE)?.value);
    if (currentFilter === 'recurring')  {
        return task.querySelector(DOM_SELECTORS.RECURRING_BTN)?.classList.contains(DOM_CLASSES.ACTIVE) ?? false;
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
        // Restore original DOM order if we have a saved order, THEN drop it so
        // the next non-default sort captures the order as it stands now (a task
        // added or dragged meanwhile belongs in the next baseline).
        if (originalTaskOrder) {
            originalTaskOrder.forEach(id => {
                const el = taskList.querySelector(DATA_SELECTORS.elementByTaskId(id));
                if (el) taskList.appendChild(el);
            });
            originalTaskOrder = null;
        }
        return;
    }

    // Capture original order the first time we apply a non-default sort
    if (!originalTaskOrder) {
        originalTaskOrder = tasks.map(t => t.dataset.taskId).filter(Boolean);
    }

    // Strip leading emojis (including ZWJ sequences) so A-Z sorts by the text, not the emoji code point
    const stripLeadingEmoji = (text) => text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');

    const sorted = [...tasks].sort((a, b) => {
        if (currentSort === 'az') {
            const ta = stripLeadingEmoji(a.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '');
            const tb = stripLeadingEmoji(b.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '');
            return ta.localeCompare(tb);
        }
        if (currentSort === 'priority') {
            const pa = a.classList.contains(DOM_CLASSES.HIGH_PRIORITY) ? 0 : 1;
            const pb = b.classList.contains(DOM_CLASSES.HIGH_PRIORITY) ? 0 : 1;
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

    // 1. Apply sort (reorders DOM nodes in the active list)
    applySortToDOM(tasks, taskList);

    // 2. Apply text + category filter (show/hide each task) to BOTH the active list
    //    AND the completed-tasks dropdown. When that feature is enabled, completed
    //    tasks live in #completedTaskList — filtering only #taskList would leave them
    //    visible regardless of the search query.
    const applyTo = (task) => {
        const taskText = task.querySelector(DOM_SELECTORS.TASK_TEXT)?.textContent?.toLowerCase() || '';
        const textMatch = lowerQuery === '' || taskText.includes(lowerQuery);
        const categoryMatch = matchesFilter(task);
        task.style.display = (textMatch && categoryMatch) ? '' : 'none';
    };
    [...taskList.querySelectorAll(DOM_SELECTORS.TASK)].forEach(applyTo);

    const completedList = deps.getElementById(DOM_IDS.COMPLETED_TASK_LIST);
    if (completedList) {
        [...completedList.querySelectorAll(DOM_SELECTORS.TASK)].forEach(applyTo);
    }
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
 * Re-apply the active filter/sort after the task list is re-rendered.
 *
 * Filtering is implemented as inline `display: none` on each task element and
 * sorting as DOM node order — both live only in the DOM. taskRenderer rebuilds
 * the list with `replaceChildren`, so both are discarded, leaving every task
 * visible in state order while the search box and chips still read as active.
 * Newly appended tasks have the same problem: they arrive unfiltered.
 *
 * Reproduced Aug 2026: filter 4 tasks down to 1, press Undo (the only
 * cross-module `type: 'full'` request — undoRedoManager), and all 4 come back
 * while the input still shows the query. Adding a task under an active filter
 * likewise renders it visible regardless of the query.
 *
 * Called from uiOrchestrator._executeTaskUpdates, which is the single point all
 * update types pass through (full / patch / remove / reorder) — hooking the
 * renderer alone would miss the append path.
 */
export function reapplyActiveFilter() {
    const deps = di.resolve();
    const input = deps.getElementById(DOM_IDS.TASK_SEARCH_INPUT);
    const query = input?.value || '';

    // Read the module's own state, NOT the DOM. The "All" chip ships with
    // class="filter-chip active" in the markup, so a
    // `querySelector('.filter-chip.active')` test is ALWAYS true and would
    // never let this return early — turning the guard into dead code and
    // running a full DOM pass on every render. Sort is checked too: a
    // non-default sort is lost by the same mechanism.
    if (!query && currentFilter === 'all' && currentSort === 'default') return;

    applyFiltersAndSort(query);
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
                const el = taskList.querySelector(DATA_SELECTORS.elementByTaskId(id));
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
        filterRow.querySelectorAll(DOM_SELECTORS.FILTER_CHIP).forEach(b => {
            const isAll = b.dataset.filter === 'all';
            b.classList.toggle(DOM_CLASSES.ACTIVE, isAll);
            b.setAttribute('aria-pressed', String(isAll));
        });
        filterRow.querySelectorAll(DOM_SELECTORS.SORT_CHIP).forEach(b => {
            const isDef = b.dataset.sort === 'default';
            b.classList.toggle(DOM_CLASSES.ACTIVE, isDef);
            b.setAttribute('aria-pressed', String(isDef));
        });
        // Re-collapse the filter chip group
        const filterChipGroup = filterRow.querySelector(DOM_SELECTORS.FILTER_CHIP_GROUP);
        if (filterChipGroup) {
            filterChipGroup.classList.add(DOM_CLASSES.COLLAPSED);
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

