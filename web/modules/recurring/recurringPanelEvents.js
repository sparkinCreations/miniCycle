/**
 * miniCycle Recurring Tasks - Panel Event Delegation
 *
 * Purpose: Memory-efficient event delegation for recurring panel UI
 * Replaces 35-60+ anonymous listeners with ~5 delegated listeners
 *
 * @module recurringPanelEvents
 * @version 1.0.0
 */

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
        console.log('Recurring panel event delegation already initialized');
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

    state._eventDelegationInitialized = true;
    console.log('Recurring panel event delegation initialized (memory leak fix applied)');
    return true;
}

/**
 * Event delegation for monthly day boxes
 * Replaces 31 listeners with 1
 * @param {Object} deps - Dependencies
 */
export function setupMonthlyDayDelegation(deps) {
    const container = deps.querySelector(".monthly-days");
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const dayBox = event.target.closest(".monthly-day-box");
        if (!dayBox) return;

        dayBox.classList.toggle("selected");
    });
}

/**
 * Event delegation for weekly day boxes
 * Replaces 7 listeners with 1
 * @param {Object} deps - Dependencies
 */
export function setupWeeklyDayDelegation(deps) {
    const container = deps.querySelector(".weekly-days");
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const dayBox = event.target.closest(".weekly-day-box");
        if (!dayBox) return;

        dayBox.classList.toggle("selected");
    });
}

/**
 * Event delegation for yearly month boxes
 * Replaces 12 listeners with 1
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 */
export function setupYearlyMonthDelegation(deps, state, callbacks) {
    const container = deps.querySelector(".yearly-months");
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const monthBox = event.target.closest(".yearly-month-box");
        if (!monthBox) return;

        // Toggle selection
        monthBox.classList.toggle("selected");

        const selectedMonths = callbacks.getSelectedYearlyMonths();

        // Reveal or hide the specific-days checkbox label
        const specificDaysLabel = deps.getElementById("yearly-specific-days-label");
        if (specificDaysLabel) {
            specificDaysLabel.classList.toggle("hidden", selectedMonths.length === 0);
        }

        // Show/hide day container based on selection + checkbox state
        const yearlySpecificDaysCheckbox = deps.getElementById("yearly-specific-days");
        const yearlyDayContainer = deps.getElementById("yearly-day-container");

        if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
            const shouldShow = yearlySpecificDaysCheckbox.checked && selectedMonths.length > 0;
            yearlyDayContainer.classList.toggle("hidden", !shouldShow);
        }

        // Update dropdown
        const yearlyMonthSelect = deps.getElementById("yearly-month-select");
        if (yearlyMonthSelect) {
            yearlyMonthSelect.innerHTML = "";

            selectedMonths.forEach((monthNum) => {
                const option = document.createElement("option");
                option.value = monthNum;
                option.textContent = new Date(0, monthNum - 1).toLocaleString('default', { month: 'long' });
                yearlyMonthSelect.appendChild(option);
            });

            // Trigger month change to update day grid
            if (selectedMonths.length === 1) {
                yearlyMonthSelect.value = selectedMonths[0];
                yearlyMonthSelect.dispatchEvent(new Event("change"));
            }
        }
    });
}

/**
 * Event delegation for yearly day boxes
 * Replaces 31 listeners with 1 (with complex apply-to-all logic)
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 */
export function setupYearlyDayDelegation(deps, state, callbacks) {
    const container = deps.getElementById("yearly-day-container");
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const dayBox = event.target.closest(".yearly-day-box");
        if (!dayBox) return;

        const day = parseInt(dayBox.getAttribute("data-day"));
        if (isNaN(day)) return;

        dayBox.classList.toggle("selected");
        const isNowSelected = dayBox.classList.contains("selected");

        // Get current state
        const applyToAll = deps.getElementById("yearly-apply-all")?.checked || false;
        const monthNumber = parseInt(deps.getElementById("yearly-month-select")?.value);
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
    });
}

/**
 * Event delegation for task list items
 * Replaces N×3 listeners (checkbox, remove, row click) with 1 delegated listener
 * @param {Object} deps - Dependencies
 * @param {Object} state - Panel state
 * @param {Object} callbacks - Callback functions
 */
export function setupTaskListDelegation(deps, state, callbacks) {
    const container = deps.getElementById("recurring-task-list");
    if (!container) return;

    deps.safeAddEventListener(container, "click", (event) => {
        const item = event.target.closest(".recurring-task-item");
        if (!item) return;

        // Handle checkbox clicks
        const checkbox = event.target.closest(".recurring-check");
        if (checkbox) {
            event.stopPropagation();
            item.classList.toggle("checked");
            return;
        }

        // Handle remove button clicks
        const removeBtn = event.target.closest(".recurring-remove-btn");
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
        deps.querySelectorAll(".recurring-task-item").forEach(el => {
            el.classList.remove("selected");
        });
        item.classList.add("selected");

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
    });
}

console.log('recurringPanelEvents module loaded');
