/**
 * miniCycle Recurring Tasks - Panel Event Delegation
 *
 * Purpose: Memory-efficient event delegation for recurring panel UI
 * Replaces 35-60+ anonymous listeners with ~5 delegated listeners
 *
 * @module recurringPanelEvents
 * @version 1.0.0
 */

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, LIMITS, DEBOUNCE } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { handleGridArrowNav, handleVerticalArrowNav } from '../utils/keyboardNav.js';

// ============================================================================
// EVENT DELEGATION FUNCTIONS
// ============================================================================

/**
 * Initialize all event delegation for the recurring panel
 * @param {Object} deps - Dependencies (getElementById, querySelector, etc.)
 * @param {Object} state - Panel state (selectedYearlyDays, selectedTaskId)
 * @param {Object} callbacks - Callback functions (handleRemoveTask, showTaskSummaryPreview, getSelectedYearlyMonths)
 * @returns {boolean} Whether delegation was initialized
 */
export function initEventDelegation(deps, state, callbacks) {
    if (state._eventDelegationInitialized) {
        return false;
    }

    // Setup delegation for monthly day boxes
    setupMonthlyDayDelegation(deps);

    // Setup delegation for weekly day boxes
    setupWeeklyDayDelegation(deps);

    // Setup delegation for yearly month boxes
    setupYearlyMonthDelegation(deps, state, callbacks);

    // Setup delegation for yearly day boxes
    setupYearlyDayDelegation(deps, state, callbacks);

    // Setup delegation for task list items
    setupTaskListDelegation(deps, state, callbacks);

    // Setup the panel's own search
    setupSearchDelegation(deps, state);

    state._eventDelegationInitialized = true;
    return true;
}

/**
 * Toggle a day/month box selection and sync aria-checked
 * @param {HTMLElement} box - The day or month box element
 * @returns {void}
 */
function toggleDayBox(box) {
    box.classList.toggle(DOM_CLASSES.SELECTED);
    box.setAttribute("aria-checked", box.classList.contains(DOM_CLASSES.SELECTED) ? "true" : "false");
}

/**
 * Keyboard handler for day/month box containers — Enter/Space toggles selection,
 * arrow keys navigate between boxes
 * @param {KeyboardEvent} event - The keydown event
 * @param {string} selector - CSS selector for the box elements
 * @param {HTMLElement} [container] - Grid container (required for arrow nav)
 * @returns {HTMLElement|undefined} The matched box element, or undefined if no match
 */
function handleDayBoxKeydown(event, selector, container) {
    // Arrow key navigation
    if (container && handleGridArrowNav(event, container, selector)) return;

    if (event.key !== 'Enter' && event.key !== ' ') return;
    const box = event.target.closest(selector);
    if (!box) return;
    event.preventDefault();
    return box;
}

/**
 * Event delegation for monthly day boxes
 * Replaces 31 listeners with 1
 * @param {Object} deps - Dependencies
 * @returns {void}
 */
export function setupMonthlyDayDelegation(deps) {
    const container = deps.querySelector(DOM_SELECTORS.MONTHLY_DAYS);
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const dayBox = event.target.closest(DOM_SELECTORS.MONTHLY_DAY_BOX);
        if (!dayBox) return;

        toggleDayBox(dayBox);
    });

    deps.safeAddEventListener(container, "keydown", (event) => {
        const dayBox = handleDayBoxKeydown(event, DOM_SELECTORS.MONTHLY_DAY_BOX, container);
        if (!dayBox) return;

        toggleDayBox(dayBox);
    });
}

/**
 * Event delegation for weekly day boxes
 * Replaces 7 listeners with 1
 * @param {Object} deps - Dependencies
 * @returns {void}
 */
export function setupWeeklyDayDelegation(deps) {
    const container = deps.querySelector(DOM_SELECTORS.WEEKLY_DAYS);
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const dayBox = event.target.closest(DOM_SELECTORS.WEEKLY_DAY_BOX);
        if (!dayBox) return;

        toggleDayBox(dayBox);
    });

    deps.safeAddEventListener(container, "keydown", (event) => {
        const dayBox = handleDayBoxKeydown(event, DOM_SELECTORS.WEEKLY_DAY_BOX, container);
        if (!dayBox) return;

        toggleDayBox(dayBox);
    });
}

/**
 * Event delegation for yearly month boxes
 * Replaces 12 listeners with 1
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 * @returns {void}
 */
export function setupYearlyMonthDelegation(deps, state, callbacks) {
    const container = deps.querySelector(DOM_SELECTORS.YEARLY_MONTHS);
    if (!container) return;

    function handleMonthToggle(monthBox) {
        toggleDayBox(monthBox);

        const selectedMonths = callbacks.getSelectedYearlyMonths();

        // Reveal or hide the specific-days checkbox label and apply-all label
        const specificDaysLabel = deps.getElementById(DOM_IDS.YEARLY_SPECIFIC_DAYS_LABEL);
        if (specificDaysLabel) {
            specificDaysLabel.classList.toggle(DOM_CLASSES.HIDDEN, selectedMonths.length === 0);
        }
        const applyAllLabel = deps.getElementById(DOM_IDS.YEARLY_APPLY_ALL_LABEL);
        if (applyAllLabel) {
            applyAllLabel.classList.toggle(DOM_CLASSES.HIDDEN, selectedMonths.length === 0);
        }

        // Show/hide day container based on selection + checkbox state
        const yearlySpecificDaysCheckbox = deps.getElementById(DOM_IDS.YEARLY_SPECIFIC_DAYS);
        const yearlyDayContainer = deps.getElementById(DOM_IDS.YEARLY_DAY_CONTAINER);

        if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
            const shouldShow = yearlySpecificDaysCheckbox.checked && selectedMonths.length > 0;
            yearlyDayContainer.classList.toggle(DOM_CLASSES.HIDDEN, !shouldShow);
        }

        // Update dropdown
        const yearlyMonthSelect = deps.getElementById(DOM_IDS.YEARLY_MONTH_SELECT);
        if (yearlyMonthSelect) {
            yearlyMonthSelect.innerHTML = "";

            selectedMonths.forEach((monthNum) => {
                const option = document.createElement("option");
                option.value = monthNum;
                option.textContent = new Date(0, monthNum - 1).toLocaleString('default', { month: 'long' });
                yearlyMonthSelect.appendChild(option);
            });

            // Trigger month change to update day grid and label
            if (selectedMonths.length > 0) {
                yearlyMonthSelect.value = selectedMonths[0];
                yearlyMonthSelect.dispatchEvent(new Event("change"));
            }
        }
    }

    deps.safeAddEventListener(container, "click", (event) => {
        const monthBox = event.target.closest(DOM_SELECTORS.YEARLY_MONTH_BOX);
        if (!monthBox) return;

        handleMonthToggle(monthBox);
    });

    deps.safeAddEventListener(container, "keydown", (event) => {
        const monthBox = handleDayBoxKeydown(event, DOM_SELECTORS.YEARLY_MONTH_BOX, container);
        if (!monthBox) return;

        handleMonthToggle(monthBox);
    });
}

/**
 * Event delegation for yearly day boxes
 * Replaces 31 listeners with 1 (with complex apply-to-all logic)
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 * @returns {void}
 */
export function setupYearlyDayDelegation(deps, state, callbacks) {
    const container = deps.getElementById(DOM_IDS.YEARLY_DAY_CONTAINER);
    if (!container) return;

    function handleYearlyDayToggle(dayBox) {
        const day = parseInt(dayBox.getAttribute("data-day"));
        if (isNaN(day)) return;

        toggleDayBox(dayBox);
        const isNowSelected = dayBox.classList.contains(DOM_CLASSES.SELECTED);

        // Get current state
        const applyToAll = deps.getElementById(DOM_IDS.YEARLY_APPLY_ALL)?.checked || false;
        const monthNumber = parseInt(deps.getElementById(DOM_IDS.YEARLY_MONTH_SELECT)?.value);
        const activeMonths = callbacks.getSelectedYearlyMonths();

        if (applyToAll) {
            // Update shared days
            const sharedDays = state.selectedYearlyDays["all"] || [];
            if (isNowSelected && !sharedDays.includes(day)) {
                sharedDays.push(day);
            } else if (!isNowSelected && sharedDays.includes(day)) {
                const idx = sharedDays.indexOf(day);
                sharedDays.splice(idx, 1);
            }

            state.selectedYearlyDays["all"] = sharedDays;

            // Sync all selected months
            activeMonths.forEach(month => {
                state.selectedYearlyDays[month] = [...sharedDays];
            });
        } else {
            // Regular mode, per-month
            const current = state.selectedYearlyDays[monthNumber] || [];
            if (isNowSelected && !current.includes(day)) {
                current.push(day);
            } else if (!isNowSelected && current.includes(day)) {
                const idx = current.indexOf(day);
                current.splice(idx, 1);
            }
            state.selectedYearlyDays[monthNumber] = current;
        }
    }

    deps.safeAddEventListener(container, "click", (event) => {
        const dayBox = event.target.closest(DOM_SELECTORS.YEARLY_DAY_BOX);
        if (!dayBox) return;

        handleYearlyDayToggle(dayBox);
    });

    deps.safeAddEventListener(container, "keydown", (event) => {
        const dayBox = handleDayBoxKeydown(event, DOM_SELECTORS.YEARLY_DAY_BOX, container);
        if (!dayBox) return;

        handleYearlyDayToggle(dayBox);
    });
}

/**
 * Event delegation for task list items
 * Replaces N×3 listeners (checkbox, remove, row click) with 1 delegated listener
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 * @returns {void}
 */
export function setupTaskListDelegation(deps, state, callbacks) {
    const container = deps.getElementById(DOM_IDS.RECURRING_TASK_LIST);
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const item = event.target.closest(DOM_SELECTORS.RECURRING_TASK_ITEM);
        if (!item) return;

        // Handle checkbox clicks
        const checkbox = event.target.closest(DOM_SELECTORS.RECURRING_CHECK);
        if (checkbox) {
            event.stopPropagation();
            item.classList.toggle(DOM_CLASSES.CHECKED);
            return;
        }

        // Handle remove button clicks
        const removeBtn = event.target.closest(DOM_SELECTORS.RECURRING_REMOVE_BTN);
        if (removeBtn) {
            event.stopPropagation();
            const taskId = item.getAttribute("data-task-id");
            if (taskId && deps.AppState?.isReady?.()) {
                // Get template from recurringTemplates (not tasks array)
                const currentState = deps.AppState.get();
                const activeCycleId = currentState.appState?.activeCycleId;
                const currentCycle = currentState.data?.cycles?.[activeCycleId];
                const template = currentCycle?.recurringTemplates?.[taskId];

                if (template && callbacks.handleRemoveTask) {
                    callbacks.handleRemoveTask(template, item);
                }
            }
            return;
        }

        // Handle row click for selection
        selectTaskItem(item, deps, state, callbacks);
    });

    // Double-click to toggle checkbox
    deps.safeAddEventListener(container, "dblclick", (event) => {
        const item = event.target.closest(DOM_SELECTORS.RECURRING_TASK_ITEM);
        if (!item) return;
        // Don't toggle if double-clicking the remove button
        if (event.target.closest(DOM_SELECTORS.RECURRING_REMOVE_BTN)) return;
        item.classList.toggle(DOM_CLASSES.CHECKED);
        const checkbox = item.querySelector(DOM_SELECTORS.RECURRING_CHECK);
        if (checkbox) checkbox.checked = item.classList.contains(DOM_CLASSES.CHECKED);
    });

    // Keyboard navigation for task list items
    deps.safeAddEventListener(container, "keydown", (event) => {
        const item = event.target.closest(DOM_SELECTORS.RECURRING_TASK_ITEM);
        if (!item) return;

        // Arrow key navigation between task items
        if (handleVerticalArrowNav(event, container, DOM_SELECTORS.RECURRING_TASK_ITEM)) return;

        // Enter/Space to select task
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectTaskItem(item, deps, state, callbacks);
        }
    });
}

/**
 * Select a recurring task item and show its summary preview
 * @param {HTMLElement} item - The task item element
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 * @returns {void}
 */
function selectTaskItem(item, deps, state, callbacks) {
    deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
        el.classList.remove(DOM_CLASSES.SELECTED);
        el.setAttribute("aria-selected", "false");
    });
    item.classList.add(DOM_CLASSES.SELECTED);
    item.setAttribute("aria-selected", "true");

    const taskId = item.getAttribute("data-task-id");
    state.selectedTaskId = taskId;

    // Get fresh data from AppState - ONLY use recurringTemplates
    if (deps.AppState?.isReady?.()) {
        const currentState = deps.AppState.get();
        const activeCycleId = currentState.appState?.activeCycleId;
        const currentCycle = currentState.data?.cycles?.[activeCycleId];

        // Get task from recurringTemplates ONLY (independent from tasks array)
        const template = currentCycle?.recurringTemplates?.[taskId];

        if (template && callbacks.showTaskSummaryPreview) {
            // Use the template directly (it has all needed properties)
            callbacks.showTaskSummaryPreview(template);
        } else if (!template) {
            console.warn('Template not found for task:', taskId);
        }
    }

    // If already editing, stay in editing mode — just update the preview
    // without repopulating the form (user may be making bulk changes).
    // Otherwise transition to previewing.
    if (callbacks.getPanelMode?.() !== 'editing') {
        callbacks.setPanelMode?.('previewing');
    }
}

// ============================================================================
// PANEL SEARCH
// ============================================================================

/**
 * Filter the recurring list in place.
 *
 * Scoped to THIS panel on purpose. The task-list search filters `#taskList`, and
 * the two surfaces hold different objects: a task can be checked off, a template
 * can only be rescheduled or removed. One search spanning both would return rows
 * that mean different things and afford different actions, so each surface
 * searches what it owns.
 *
 * Reads the rendered rows because that is exactly what it filters — visibility of
 * elements already on screen. It never decides anything about DATA; the panel
 * renders from `cycle.recurringTemplates`, which stays the source of truth.
 *
 * @param {Object} deps - {getElementById, querySelectorAll}
 * @param {Object} state - Panel state (holds the active query across re-renders)
 * @returns {void}
 */
export function applyRecurringSearch(deps, state) {
    const list = deps.getElementById(DOM_IDS.RECURRING_TASK_LIST);
    if (!list) return;

    const input = deps.getElementById(DOM_IDS.RECURRING_SEARCH_INPUT);
    const row = deps.getElementById(DOM_IDS.RECURRING_SEARCH_ROW);
    const noMatches = deps.getElementById(DOM_IDS.RECURRING_NO_MATCHES);

    const items = Array.from(list.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM));

    // Below the threshold the whole list is already on screen, so a search box is
    // chrome rather than help. Hiding it also clears any stale query, otherwise
    // removing tasks down past the threshold could leave rows filtered out with
    // no visible control to undo it.
    if (row) {
        const show = items.length >= LIMITS.RECURRING_SEARCH_THRESHOLD;
        row.classList.toggle(DOM_CLASSES.HIDDEN, !show);
        if (!show && state) state.searchQuery = '';
        if (!show && input) input.value = '';
    }

    const query = (state?.searchQuery || '').toLowerCase().trim();
    let visible = 0;
    items.forEach(item => {
        const text = item.querySelector(DOM_SELECTORS.RECURRING_TASK_TEXT)?.textContent?.toLowerCase() || '';
        const match = query === '' || text.includes(query);
        item.classList.toggle(DOM_CLASSES.HIDDEN, !match);
        if (match) visible++;
    });

    // "No recurring tasks yet" and "nothing matched your search" are different
    // facts; conflating them would tell a user with 20 templates that they have
    // none. Separate element, and only one can be showing.
    if (noMatches) {
        const showNoMatches = query !== '' && visible === 0 && items.length > 0;
        noMatches.classList.toggle(DOM_CLASSES.HIDDEN, !showNoMatches);
        if (showNoMatches) {
            noMatches.textContent = getLabel('recurring.noMatches', { vars: { query: state.searchQuery.trim() } });
        }
    }

    announceSearchResults(deps, state, visible, items.length);
}

/**
 * Announce the result count to screen readers.
 *
 * A sighted user watches the list shrink; without this a screen-reader user gets
 * no feedback at all — measured, filtering 7 rows down to 2 said nothing, and
 * only the zero-match case spoke. That is the state-change-never-reaches-the-
 * live-region class the v2.534-v2.536 work was about.
 *
 * The region lives INSIDE the dialog deliberately. `showModal()` marks everything
 * outside the dialog inert and inert content leaves the accessibility tree, so
 * utils/announce.js's body-level #live-region is unreadable while this panel is
 * open — that module's docblock records two reverted attempts at working around
 * it. A region inside the dialog subtree has no such problem.
 *
 * Debounced: announcing on every keystroke makes a screen reader unusable while
 * typing.
 *
 * @param {Object} deps - {getElementById}
 * @param {Object} state - Panel state (holds the debounce timer)
 * @param {number} visible - Rows matching the query
 * @param {number} total - Rows in the list
 * @returns {void}
 */
function announceSearchResults(deps, state, visible, total) {
    const status = deps.getElementById(DOM_IDS.RECURRING_SEARCH_STATUS);
    if (!status || !state) return;

    if (state._searchAnnounceTimer) clearTimeout(state._searchAnnounceTimer);

    const query = (state.searchQuery || '').trim();
    // Nothing to say before the user has searched, and on an empty list the
    // panel's own empty state already speaks.
    if (total === 0) { status.textContent = ''; return; }

    const message = query === ''
        ? getLabel('recurring.searchCleared', { vars: { total } })
        : (visible === 1
            ? getLabel('recurring.searchResultsOne', { vars: { total } })
            : getLabel('recurring.searchResults', { vars: { count: visible, total } }));

    state._searchAnnounceTimer = setTimeout(() => {
        state._searchAnnounceTimer = null;
        // Clear first so an identical consecutive message is still a real
        // empty->text transition; screen readers skip unchanged content
        // (utils/announce.js documents the same behaviour).
        status.textContent = '';
        const raf = (typeof requestAnimationFrame === 'function')
            ? requestAnimationFrame : ((fn) => setTimeout(fn, 16));
        raf(() => { status.textContent = message; });
    }, DEBOUNCE.SEARCH_RESULT_ANNOUNCE);
}

/**
 * Wire the panel's search input. One delegated listener, added through
 * safeAddEventListener so a panel re-open cannot stack duplicates.
 * @param {Object} deps - {getElementById, querySelectorAll, safeAddEventListener}
 * @param {Object} state - Panel state
 * @returns {void}
 */
export function setupSearchDelegation(deps, state) {
    const input = deps.getElementById(DOM_IDS.RECURRING_SEARCH_INPUT);
    if (!input) return;

    deps.safeAddEventListener(input, 'input', () => {
        state.searchQuery = input.value || '';
        applyRecurringSearch(deps, state);
    });

    // Escape clears rather than closing the panel — a filtered list with a
    // dismissed keyboard is otherwise hard to reset on touch.
    deps.safeAddEventListener(input, 'keydown', (event) => {
        if (event.key !== 'Escape' || !input.value) return;
        event.stopPropagation();
        input.value = '';
        state.searchQuery = '';
        applyRecurringSearch(deps, state);
    });
}
