/**
 * miniCycle Recurring Tasks - Panel Form Operations
 *
 * Purpose: Form data reading, writing, and utility functions
 *
 * DI PATTERN NOTE: This module uses diBase.js for its callback dependencies
 * (updateRecurringSummary, normalizeRecurringSettings) which are injected by
 * RecurringPanel after dynamic import. The exported utility functions also take
 * explicit `deps` parameters for DOM helpers — this is intentional for the same
 * reasons documented in recurringPanelSetup.js (pure, testable, no manifest overhead).
 *
 * @module recurringPanelForm
 * @version 1.1.0
 */

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('RecurringPanelForm', {
    updateRecurringSummary: optional(null),
    normalizeRecurringSettings: optional(null),
});

export const setFormActions = di.setDependencies;

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
        // Local midnight, not "this time tomorrow". Every consumer wants a
        // calendar day, and carrying the current clock time is what let the
        // old valueAsDate assignment tip over into the next UTC day.
        tomorrow.setHours(0, 0, 0, 0);

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
 * Parse a native <input type="time"> value ("HH:MM", 24-hour) into the stored
 * recurring time shape { hour, minute, meridiem, military }. The scheduling core
 * (recurringMatcher / recurringCalculators / recurringPanelSummary) reads this
 * shape, so it stays stable — only the form control changed. Empty/invalid input
 * defaults to 12:00 AM (midnight).
 * @param {string} value - "HH:MM" from a native time input
 * @returns {{hour:number, minute:number, meridiem:string, military:boolean}}
 */
export function parseTimeInput(value) {
    const [h = 0, m = 0] = String(value || '').split(':').map(n => parseInt(n, 10) || 0);
    const hour24 = Math.min(23, Math.max(0, h));
    const minute = Math.min(59, Math.max(0, m));
    return {
        hour: (hour24 % 12) || 12,          // 12-hour value (0 → 12, 13 → 1)
        minute,
        meridiem: hour24 < 12 ? 'AM' : 'PM',
        military: false                      // store 12-hour so summaries read "1:00 PM"
    };
}

/**
 * Format the stored recurring time shape into a native <input type="time"> value
 * ("HH:MM", 24-hour). Handles both 12-hour (meridiem) and legacy military-stored
 * templates so existing saved recurring tasks keep loading correctly.
 * @param {{hour:number, minute:number, meridiem?:string, military?:boolean}} time
 * @returns {string} "HH:MM", or "" when no time is set
 */
export function toTimeInputValue(time) {
    if (!time) return '';
    const minute = Number.isInteger(time.minute) ? time.minute : 0;
    let hour24;
    if (time.military) {
        hour24 = time.hour;
    } else if (time.meridiem === 'PM') {
        hour24 = time.hour === 12 ? 12 : time.hour + 12;
    } else {
        hour24 = time.hour === 12 ? 0 : time.hour;   // 12 AM → 00
    }
    hour24 = Math.min(23, Math.max(0, hour24 || 0));
    return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Get selected monthly days from DOM
 * @param {Object} deps - Dependencies (querySelectorAll)
 * @returns {number[]} Array of selected day numbers
 */
export function getSelectedMonthlyDays(deps) {
    return Array.from(deps.querySelectorAll(DOM_SELECTORS.MONTHLY_DAY_BOX_SELECTED))
                .map(el => parseInt(el.dataset.day));
}

/**
 * Get selected yearly months from DOM
 * @param {Object} deps - Dependencies (querySelectorAll)
 * @returns {number[]} Array of selected month numbers
 */
export function getSelectedYearlyMonths(deps) {
    return Array.from(deps.querySelectorAll(DOM_SELECTORS.YEARLY_MONTH_BOX_SELECTED))
                .map(el => parseInt(el.dataset.month));
}

/**
 * Update recurring count visibility based on settings
 * @param {Object} deps - Dependencies (getElementById)
 * @returns {void}
 */
export function updateRecurCountVisibility(deps) {
    const isIndefinite = deps.getElementById(DOM_IDS.RECUR_INDEFINITELY)?.checked;
    const isUsingSpecificDates = deps.getElementById(DOM_IDS.RECUR_SPECIFIC_DATES)?.checked;
    const countContainer = deps.getElementById(DOM_IDS.RECUR_COUNT_CONTAINER);

    if (!countContainer) return;

    // Only show if NOT using specific dates AND NOT recurring indefinitely
    const shouldShow = !isUsingSpecificDates && !isIndefinite;
    countContainer.classList.toggle(DOM_CLASSES.HIDDEN, !shouldShow);
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
        const frequency = deps.getElementById(DOM_IDS.RECUR_FREQUENCY)?.value || "daily";

        // Determine duration mode
        const indefinitelyCheckbox = deps.getElementById(DOM_IDS.RECUR_INDEFINITELY);
        const indefinitely = indefinitelyCheckbox?.checked ?? true;

        let count = null;
        let untilDate = null;

        // If not indefinite, check which limited duration option is selected
        if (!indefinitely) {
            const countRadio = deps.getElementById(DOM_IDS.RECUR_COUNT_RADIO);
            const untilRadio = deps.getElementById(DOM_IDS.RECUR_UNTIL_RADIO);

            if (countRadio?.checked) {
                count = parseInt(deps.getElementById(DOM_IDS.RECUR_COUNT_INPUT)?.value) || 1;
            } else if (untilRadio?.checked) {
                untilDate = deps.getElementById(DOM_IDS.RECUR_UNTIL_DATE)?.value || null;
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
        if (deps.getElementById(DOM_IDS.RECUR_SPECIFIC_DATES)?.checked) {
            const dateInputs = deps.querySelectorAll(DOM_SELECTORS.SPECIFIC_DATE_INPUT);
            settings.specificDates.enabled = true;
            settings.specificDates.dates = Array.from(dateInputs).map(input => input.value).filter(Boolean);

            if (deps.getElementById(DOM_IDS.SPECIFIC_DATE_SPECIFIC_TIME)?.checked) {
                settings.useSpecificTime = true;
                settings.time = parseTimeInput(deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME)?.value);
            }
        } else {
            // Time block for non-specific-dates
            const timeEnabled = deps.getElementById(DOM_IDS.freqSpecificTime(frequency))?.checked;

            // Time block for non-specific-dates - EXCLUDE hourly!
            if (frequency !== "hourly" && timeEnabled) {
                settings.useSpecificTime = true;
                settings.time = parseTimeInput(deps.getElementById(DOM_IDS.freqTime(frequency))?.value);
            }

            // Hourly Specific Minute
            if (frequency === "hourly") {
                const useSpecificMinute = deps.getElementById(DOM_IDS.HOURLY_SPECIFIC_TIME)?.checked;
                const minuteEl = deps.getElementById(DOM_IDS.HOURLY_MINUTE);

                settings.hourly = {
                    useSpecificMinute: !!useSpecificMinute,
                    minute: useSpecificMinute && minuteEl ? parseInt(minuteEl.value) || 0 : 0
                };
            }

            // Weekly
            if (frequency === "weekly") {
                settings[frequency] = {
                    useSpecificDays: deps.getElementById(DOM_IDS.WEEKLY_SPECIFIC_DAYS)?.checked,
                    days: Array.from(deps.querySelectorAll(DOM_SELECTORS.WEEKLY_DAY_BOX_SELECTED)).map(el => el.dataset.day)
                };
            }

            // Biweekly (separate weeks)
            if (frequency === "biweekly") {
                settings.biweekly = {
                    useSpecificDays: deps.getElementById(DOM_IDS.BIWEEKLY_SPECIFIC_DAYS)?.checked,
                    week1: Array.from(deps.querySelectorAll(DOM_SELECTORS.BIWEEKLY_WEEK1_SELECTED)).map(el => el.dataset.day),
                    week2: Array.from(deps.querySelectorAll(DOM_SELECTORS.BIWEEKLY_WEEK2_SELECTED)).map(el => el.dataset.day)
                };
            }

            // Monthly
            if (frequency === "monthly") {
                const useSpecificDays = deps.getElementById(DOM_IDS.MONTHLY_SPECIFIC_DAYS)?.checked;
                const useWeekOfMonth = deps.getElementById(DOM_IDS.MONTHLY_WEEK_OF_MONTH)?.checked;

                settings.monthly = {
                    useSpecificDays: useSpecificDays,
                    days: useSpecificDays ? Array.from(deps.querySelectorAll(DOM_SELECTORS.MONTHLY_DAY_BOX_SELECTED)).map(el => parseInt(el.dataset.day)) : [],
                    lastDay: useSpecificDays ? (deps.getElementById(DOM_IDS.MONTHLY_LAST_DAY)?.checked || false) : false,
                    useWeekOfMonth: useWeekOfMonth,
                    weekOfMonth: useWeekOfMonth ? {
                        ordinal: deps.getElementById(DOM_IDS.MONTHLY_WEEK_ORDINAL)?.value || "1",
                        day: deps.getElementById(DOM_IDS.MONTHLY_WEEK_DAY)?.value || "Mon"
                    } : null
                };
            }

            // Yearly
            if (frequency === "yearly") {
                const applyAll = deps.getElementById(DOM_IDS.YEARLY_APPLY_DAYS_TO_ALL)?.checked;
                const useMonths = deps.getElementById(DOM_IDS.YEARLY_SPECIFIC_MONTHS)?.checked;
                const useDays = deps.getElementById(DOM_IDS.YEARLY_SPECIFIC_DAYS)?.checked;

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
        const resolved = di.resolve();
        if (resolved.normalizeRecurringSettings) {
            return resolved.normalizeRecurringSettings(settings);
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
 * @returns {void}
 */
export function populateRecurringFormWithSettings(deps, settings) {

    try {
        // Frequency dropdown — dispatches 'change' to show correct frequency section
        const frequencySelect = deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
        if (frequencySelect && settings.frequency) {
            frequencySelect.value = settings.frequency;
            frequencySelect.dispatchEvent(new Event('change'));
        }

        // Indefinite checkbox
        const indefiniteCheckbox = deps.getElementById(DOM_IDS.RECUR_INDEFINITELY);
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = settings.indefinitely !== false;
            indefiniteCheckbox.dispatchEvent(new Event('change'));
        }

        // Duration type: count or until date
        if (settings.indefinitely === false) {
            if (settings.count) {
                const countRadio = deps.getElementById(DOM_IDS.RECUR_COUNT_RADIO);
                if (countRadio) {
                    countRadio.checked = true;
                    countRadio.dispatchEvent(new Event('change'));
                }
                const countInput = deps.getElementById(DOM_IDS.RECUR_COUNT_INPUT);
                if (countInput) {
                    countInput.value = settings.count;
                }
            } else if (settings.untilDate) {
                const untilRadio = deps.getElementById(DOM_IDS.RECUR_UNTIL_RADIO);
                if (untilRadio) {
                    untilRadio.checked = true;
                    untilRadio.dispatchEvent(new Event('change'));
                }
                const untilDateInput = deps.getElementById(DOM_IDS.RECUR_UNTIL_DATE);
                if (untilDateInput) {
                    untilDateInput.value = settings.untilDate;
                }
            }
        }

        // Time settings — populate if a specific time is set
        if (settings.time && settings.useSpecificTime !== false) {
            const freq = settings.frequency || 'daily';
            const timeCheckbox = deps.getElementById(DOM_IDS.freqSpecificTime(freq));
            if (timeCheckbox) {
                timeCheckbox.checked = true;
                timeCheckbox.dispatchEvent(new Event('change'));
            }

            const timeInput = deps.getElementById(DOM_IDS.freqTime(freq));
            if (timeInput) timeInput.value = toTimeInputValue(settings.time);
        }

        // Update the summary display via callback
        di.resolve().updateRecurringSummary?.();

    } catch (error) {
        console.error('Error populating form with settings:', error);
    }
}

/**
 * Clear/reset the recurring form
 * @param {Object} deps - Dependencies (getElementById)
 * @returns {void}
 */
export function clearRecurringForm(deps) {

    try {
        // Reset frequency to default
        const frequencySelect = deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
        if (frequencySelect) {
            frequencySelect.value = 'daily';
            frequencySelect.dispatchEvent(new Event('change'));
        }

        // Reset indefinite checkbox
        const indefiniteCheckbox = deps.getElementById(DOM_IDS.RECUR_INDEFINITELY);
        if (indefiniteCheckbox) {
            indefiniteCheckbox.checked = true;
        }

        // Clear repeat count
        const countInput = deps.getElementById(DOM_IDS.RECUR_COUNT_INPUT);
        if (countInput) {
            countInput.value = '';
        }

    } catch (error) {
        console.error('Error clearing form:', error);
    }
}

