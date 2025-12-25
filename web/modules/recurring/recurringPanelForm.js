/**
 * miniCycle Recurring Tasks - Panel Form Operations
 *
 * Purpose: Form data reading, writing, and utility functions
 * Uses callback injection pattern for methods that need panel coordination
 *
 * @module recurringPanelForm
 * @version 1.0.0
 */

// ============================================================================
// CALLBACK INJECTION
// ============================================================================

let _actions = {};

/**
 * Set form actions for callback injection
 * @param {Object} actions - Callback functions from coordinator
 * @param {Function} actions.updateRecurringSummary - Update summary display
 * @param {Function} actions.normalizeRecurringSettings - Normalize settings object
 */
export function setFormActions(actions) {
    _actions = actions;
    console.log('recurringPanelForm actions set');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get tomorrow's date
 * @returns {Date} Tomorrow's date
 */
export function getTomorrow() {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (isNaN(tomorrow.getTime()) || tomorrow.getFullYear() > 2100) {
            throw new Error("Invalid date generated");
        }

        return tomorrow;
    } catch (error) {
        console.warn("Error generating tomorrow's date:", error);
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 1);
        return fallback;
    }
}

/**
 * Get selected monthly days from DOM
 * @param {Object} deps - Dependencies (querySelectorAll)
 * @returns {number[]} Array of selected day numbers
 */
export function getSelectedMonthlyDays(deps) {
    return Array.from(deps.querySelectorAll(".monthly-day-box.selected"))
                .map(el => parseInt(el.dataset.day));
}

/**
 * Get selected yearly months from DOM
 * @param {Object} deps - Dependencies (querySelectorAll)
 * @returns {number[]} Array of selected month numbers
 */
export function getSelectedYearlyMonths(deps) {
    return Array.from(deps.querySelectorAll(".yearly-month-box.selected"))
                .map(el => parseInt(el.dataset.month));
}

/**
 * Update recurring count visibility based on settings
 * @param {Object} deps - Dependencies (getElementById)
 */
export function updateRecurCountVisibility(deps) {
    const isIndefinite = deps.getElementById("recur-indefinitely")?.checked;
    const isUsingSpecificDates = deps.getElementById("recur-specific-dates")?.checked;
    const countContainer = deps.getElementById("recur-count-container");

    if (!countContainer) return;

    // Only show if NOT using specific dates AND NOT recurring indefinitely
    const shouldShow = !isUsingSpecificDates && !isIndefinite;
    countContainer.classList.toggle("hidden", !shouldShow);
}

// ============================================================================
// FORM DATA READING
// ============================================================================

/**
 * Build recurring settings from panel form
 * @param {Object} deps - Dependencies (getElementById, querySelectorAll)
 * @param {Object} state - Panel state (selectedYearlyDays)
 * @returns {Object} Recurring settings object
 */
export function buildRecurringSettingsFromPanel(deps, state) {
    try {
        const frequency = deps.getElementById("recur-frequency")?.value || "daily";

        // Determine duration mode
        const indefinitelyCheckbox = deps.getElementById("recur-indefinitely");
        const indefinitely = indefinitelyCheckbox?.checked ?? true;

        let count = null;
        let untilDate = null;

        // If not indefinite, check which limited duration option is selected
        if (!indefinitely) {
            const countRadio = deps.getElementById("recur-count-radio");
            const untilRadio = deps.getElementById("recur-until-radio");

            if (countRadio?.checked) {
                count = parseInt(deps.getElementById("recur-count-input")?.value) || 1;
            } else if (untilRadio?.checked) {
                untilDate = deps.getElementById("recur-until-date")?.value || null;
            }
        }

        const settings = {
            frequency,
            indefinitely,
            count,
            untilDate,
            useSpecificTime: false,
            time: null,
            specificDates: {
                enabled: false,
                dates: []
            },
            daily: {},
            hourly: {},
            weekly: {},
            biweekly: {},
            monthly: {},
            yearly: {}
        };

        // Specific Dates Mode
        if (deps.getElementById("recur-specific-dates")?.checked) {
            const dateInputs = deps.querySelectorAll("#specific-date-list input[type='date']");
            settings.specificDates.enabled = true;
            settings.specificDates.dates = Array.from(dateInputs).map(input => input.value).filter(Boolean);

            if (deps.getElementById("specific-date-specific-time")?.checked) {
                settings.useSpecificTime = true;
                settings.time = {
                    hour: parseInt(deps.getElementById("specific-date-hour")?.value) || 0,
                    minute: parseInt(deps.getElementById("specific-date-minute")?.value) || 0,
                    meridiem: deps.getElementById("specific-date-meridiem")?.value,
                    military: deps.getElementById("specific-date-military")?.checked
                };
            }
        } else {
            // Time block for non-specific-dates
            const timeId = frequency;
            const timeEnabled = deps.getElementById(`${timeId}-specific-time`)?.checked;

            // Time block for non-specific-dates - EXCLUDE hourly!
            if (frequency !== "hourly" && timeEnabled) {
                settings.useSpecificTime = true;
                settings.time = {
                    hour: parseInt(deps.getElementById(`${timeId}-hour`)?.value) || 0,
                    minute: parseInt(deps.getElementById(`${timeId}-minute`)?.value) || 0,
                    meridiem: deps.getElementById(`${timeId}-meridiem`)?.value,
                    military: deps.getElementById(`${timeId}-military`)?.checked
                };
            }

            // Hourly Specific Minute
            if (frequency === "hourly") {
                const useSpecificMinute = deps.getElementById("hourly-specific-time")?.checked;
                const minuteEl = deps.getElementById("hourly-minute");

                settings.hourly = {
                    useSpecificMinute: !!useSpecificMinute,
                    minute: useSpecificMinute && minuteEl ? parseInt(minuteEl.value) || 0 : 0
                };
            }

            // Weekly
            if (frequency === "weekly") {
                const selector = `.${frequency}-day-box.selected`;
                settings[frequency] = {
                    useSpecificDays: deps.getElementById(`${frequency}-specific-days`)?.checked,
                    days: Array.from(deps.querySelectorAll(selector)).map(el => el.dataset.day)
                };
            }

            // Biweekly (separate weeks)
            if (frequency === "biweekly") {
                settings.biweekly = {
                    useSpecificDays: deps.getElementById("biweekly-specific-days")?.checked,
                    week1: Array.from(deps.querySelectorAll(".biweekly-day-box.selected[data-week='1']")).map(el => el.dataset.day),
                    week2: Array.from(deps.querySelectorAll(".biweekly-day-box.selected[data-week='2']")).map(el => el.dataset.day)
                };
            }

            // Monthly
            if (frequency === "monthly") {
                const useSpecificDays = deps.getElementById("monthly-specific-days")?.checked;
                const useWeekOfMonth = deps.getElementById("monthly-week-of-month")?.checked;

                settings.monthly = {
                    useSpecificDays: useSpecificDays,
                    days: useSpecificDays ? Array.from(deps.querySelectorAll(".monthly-day-box.selected")).map(el => parseInt(el.dataset.day)) : [],
                    lastDay: useSpecificDays ? (deps.getElementById("monthly-last-day")?.checked || false) : false,
                    useWeekOfMonth: useWeekOfMonth,
                    weekOfMonth: useWeekOfMonth ? {
                        ordinal: deps.getElementById("monthly-week-ordinal")?.value || "1",
                        day: deps.getElementById("monthly-week-day")?.value || "Mon"
                    } : null
                };
            }

            // Yearly
            if (frequency === "yearly") {
                const applyAll = deps.getElementById("yearly-apply-days-to-all")?.checked;
                const useMonths = deps.getElementById("yearly-specific-months")?.checked;
                const useDays = deps.getElementById("yearly-specific-days")?.checked;

                settings.yearly = {
                    useSpecificMonths: useMonths,
                    months: getSelectedYearlyMonths(deps),
                    useSpecificDays: useDays,
                    daysByMonth: applyAll ? { all: state.selectedYearlyDays["all"] || [] } : { ...state.selectedYearlyDays },
                    applyDaysToAll: applyAll
                };
            }
        }

        // Normalize if action available
        if (_actions.normalizeRecurringSettings) {
            return _actions.normalizeRecurringSettings(settings);
        }
        return settings;

    } catch (error) {
        console.error('Error building settings from panel:', error);
        return { frequency: 'daily', indefinitely: true };
    }
}

// ============================================================================
// FORM DATA WRITING
// ============================================================================

/**
 * Populate recurring form with settings
 * @param {Object} deps - Dependencies (getElementById)
 * @param {Object} settings - Recurring settings to populate
 */
export function populateRecurringFormWithSettings(deps, settings) {
    console.log('Populating recurring form with settings:', settings);

    try {
        // Frequency dropdown
        const frequencySelect = deps.getElementById('recur-frequency');
        if (frequencySelect && settings.frequency) {
            frequencySelect.value = settings.frequency;
            frequencySelect.dispatchEvent(new Event('change'));
        }

        // Indefinite checkbox
        const indefiniteCheckbox = deps.getElementById('recur-indefinitely');
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = settings.indefinitely !== false;
        }

        // Repeat count
        if (settings.indefinitely === false && settings.count) {
            const countInput = deps.getElementById('recur-count-input');
            if (countInput) {
                countInput.value = settings.count;
            }
        }

        // Update the summary display via callback
        _actions.updateRecurringSummary?.();

        console.log('Form populated successfully');

    } catch (error) {
        console.error('Error populating form with settings:', error);
    }
}

/**
 * Clear/reset the recurring form
 * @param {Object} deps - Dependencies (getElementById)
 */
export function clearRecurringForm(deps) {
    console.log('Clearing recurring form');

    try {
        // Reset frequency to default
        const frequencySelect = deps.getElementById('recur-frequency');
        if (frequencySelect) {
            frequencySelect.value = 'daily';
            frequencySelect.dispatchEvent(new Event('change'));
        }

        // Reset indefinite checkbox
        const indefiniteCheckbox = deps.getElementById('recur-indefinitely');
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = true;
        }

        // Clear repeat count
        const countInput = deps.getElementById('recur-count-input');
        if (countInput) {
            countInput.value = '';
        }

        console.log('Form cleared successfully');

    } catch (error) {
        console.error('Error clearing form:', error);
    }
}

console.log('recurringPanelForm module loaded');
