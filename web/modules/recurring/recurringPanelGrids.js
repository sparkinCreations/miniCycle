/**
 * miniCycle Recurring Tasks - Panel Grid Generation
 *
 * Purpose: Generate day/month selection grids for recurring panel
 * Pure DOM generators with no event listeners (delegation handles events)
 *
 * @module recurringPanelGrids
 * @version 1.0.0
 */

// ============================================================================
// GRID GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate monthly day selection grid (days 1-31)
 * @param {Object} deps - Dependencies (querySelector)
 */
export function generateMonthlyDayGrid(deps) {
    const container = deps.querySelector(".monthly-days");
    if (!container) return;

    container.innerHTML = "";

    for (let i = 1; i <= 31; i++) {
        const dayBox = document.createElement("div");
        dayBox.className = "monthly-day-box";
        dayBox.setAttribute("data-day", i);
        dayBox.textContent = i;

        // No listener added - handled by setupMonthlyDayDelegation()

        container.appendChild(dayBox);
    }
}

/**
 * Generate yearly month selection grid (Jan-Dec)
 * @param {Object} deps - Dependencies (querySelector)
 */
export function generateYearlyMonthGrid(deps) {
    const container = deps.querySelector(".yearly-months");
    if (!container) return;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    container.innerHTML = "";

    monthNames.forEach((name, index) => {
        const monthBox = document.createElement("div");
        monthBox.className = "yearly-month-box";
        monthBox.setAttribute("data-month", index + 1);
        monthBox.textContent = name;

        // No listener added - handled by setupYearlyMonthDelegation()

        container.appendChild(monthBox);
    });
}

/**
 * Generate yearly day grid for a specific month
 * @param {Object} deps - Dependencies (querySelector, getElementById)
 * @param {Object} state - Panel state containing selectedYearlyDays
 * @param {number} monthNumber - Month number (1-12)
 */
export function generateYearlyDayGrid(deps, state, monthNumber) {
    const container = deps.querySelector(".yearly-days");
    if (!container) return;

    container.innerHTML = "";

    const daysInMonth = new Date(new Date().getFullYear(), monthNumber, 0).getDate();
    const selectedDays = state.selectedYearlyDays[monthNumber] || [];
    const yearlyApplyToAllCheckbox = deps.getElementById("yearly-apply-days-to-all");
    const applyToAll = yearlyApplyToAllCheckbox?.checked;

    // If "apply to all" is checked, use the shared day list
    const sharedDays = state.selectedYearlyDays["all"] || [];

    for (let i = 1; i <= daysInMonth; i++) {
        const dayBox = document.createElement("div");
        dayBox.className = "yearly-day-box";
        dayBox.setAttribute("data-day", i);
        dayBox.textContent = i;

        const isSelected = applyToAll
            ? sharedDays.includes(i)
            : selectedDays.includes(i);

        if (isSelected) {
            dayBox.classList.add("selected");
        }

        // No listener added - handled by setupYearlyDayDelegation()

        container.appendChild(dayBox);
    }
}

console.log('recurringPanelGrids module loaded');
