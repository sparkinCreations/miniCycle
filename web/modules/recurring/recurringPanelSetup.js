/**
 * miniCycle Recurring Tasks - Panel Setup
 *
 * Purpose: Setup functions for recurring panel UI elements
 * Extracted from recurringPanel.js to reduce file size
 *
 * DI PATTERN NOTE: This module uses explicit parameter-passing (`deps` argument)
 * instead of diBase.js. This is intentional — these are stateless helper functions
 * called exclusively by RecurringPanel, which passes its own resolved DI dependencies.
 * Parameter-passing keeps these helpers pure, testable without global wiring, and
 * avoids the overhead of separate manifests in featureBoot.js for internal utilities.
 *
 * @module recurringPanelSetup
 * @version 1.0.0
 */

import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// FREQUENCY SELECTOR
// ============================================================================

/**
 * Setup frequency selector dropdown
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 * @param {Function} onUpdate - Callback when frequency changes
 */
export function setupFrequencySelector(deps, onUpdate) {
    const frequencySelect = deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
    if (!frequencySelect) return;

    deps.safeAddEventListener(frequencySelect, "change", () => {
        const selectedFrequency = frequencySelect.value;
        const frequencyMap = {
            hourly: deps.getElementById(DOM_IDS.HOURLY_OPTIONS),
            daily: deps.getElementById(DOM_IDS.DAILY_OPTIONS),
            weekly: deps.getElementById(DOM_IDS.WEEKLY_OPTIONS),
            biweekly: deps.getElementById(DOM_IDS.BIWEEKLY_OPTIONS),
            monthly: deps.getElementById(DOM_IDS.MONTHLY_OPTIONS),
            yearly: deps.getElementById(DOM_IDS.YEARLY_OPTIONS)
        };

        // Hide all frequency option sections
        Object.values(frequencyMap).forEach(section => {
            if (section) section.classList.add("hidden");
        });

        // Show selected frequency options
        if (frequencyMap[selectedFrequency]) {
            frequencyMap[selectedFrequency].classList.remove("hidden");
        }

        // Show/hide time picker sections (surfaced outside advanced)
        const timeMap = {
            hourly: deps.getElementById(DOM_IDS.HOURLY_TIME_SECTION),
            daily: deps.getElementById(DOM_IDS.DAILY_TIME_SECTION),
            weekly: deps.getElementById(DOM_IDS.WEEKLY_TIME_SECTION),
            biweekly: deps.getElementById(DOM_IDS.BIWEEKLY_TIME_SECTION),
            monthly: deps.getElementById(DOM_IDS.MONTHLY_TIME_SECTION),
            yearly: deps.getElementById(DOM_IDS.YEARLY_TIME_SECTION),
        };

        Object.values(timeMap).forEach(section => {
            if (section) section.classList.add("hidden");
        });

        if (timeMap[selectedFrequency]) {
            timeMap[selectedFrequency].classList.remove("hidden");
        }

        onUpdate?.();
    });
}

// ============================================================================
// TOGGLE VISIBILITY
// ============================================================================

/**
 * Setup toggle visibility for various sections
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 */
export function setupToggleVisibility(deps) {
    const toggleVisibility = (triggerId, contentId) => {
        const trigger = deps.getElementById(triggerId);
        const content = deps.getElementById(contentId);
        if (trigger && content) {
            deps.safeAddEventListener(trigger, "change", () => {
                content.classList.toggle("hidden", !trigger.checked);
            });
        }
    };

    toggleVisibility(DOM_IDS.HOURLY_SPECIFIC_TIME, DOM_IDS.HOURLY_MINUTE_CONTAINER);
    toggleVisibility(DOM_IDS.freqSpecificTime('daily'), DOM_IDS.freqTimeContainer('daily'));
    toggleVisibility(DOM_IDS.WEEKLY_SPECIFIC_DAYS, DOM_IDS.WEEKLY_DAY_CONTAINER);
    toggleVisibility(DOM_IDS.freqSpecificTime('weekly'), DOM_IDS.freqTimeContainer('weekly'));
    toggleVisibility(DOM_IDS.BIWEEKLY_SPECIFIC_DAYS, DOM_IDS.BIWEEKLY_DAY_CONTAINER);
    toggleVisibility(DOM_IDS.freqSpecificTime('biweekly'), DOM_IDS.freqTimeContainer('biweekly'));
    toggleVisibility(DOM_IDS.MONTHLY_SPECIFIC_DAYS, DOM_IDS.MONTHLY_DAY_CONTAINER);
    toggleVisibility(DOM_IDS.MONTHLY_WEEK_OF_MONTH, DOM_IDS.MONTHLY_WEEK_CONTAINER);
    toggleVisibility(DOM_IDS.freqSpecificTime('monthly'), DOM_IDS.freqTimeContainer('monthly'));
    toggleVisibility(DOM_IDS.YEARLY_SPECIFIC_MONTHS, DOM_IDS.YEARLY_MONTH_CONTAINER);
    toggleVisibility(DOM_IDS.freqSpecificTime('yearly'), DOM_IDS.freqTimeContainer('yearly'));
}

// ============================================================================
// CHECK ALL TOGGLE
// ============================================================================

/**
 * Setup toggle check all button
 * @param {Object} deps - Dependencies (getElementById, querySelectorAll, safeAddEventListener)
 * @param {Function} onUpdate - Callback when selection changes
 */
export function setupToggleCheckAll(deps, onUpdate) {
    const toggleBtn = deps.getElementById(DOM_IDS.TOGGLE_CHECK_ALL);
    if (!toggleBtn) return;

    deps.safeAddEventListener(toggleBtn, "click", () => {
        const checkboxes = deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK_VISIBLE);
        const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);

        checkboxes.forEach(cb => {
            cb.checked = anyUnchecked;
            const item = cb.closest(DOM_SELECTORS.RECURRING_TASK_ITEM);
            if (item) {
                item.classList.toggle("checked", anyUnchecked);
            }
        });

        // Update button label
        toggleBtn.textContent = anyUnchecked ? getLabel('recurring.checkAll') : getLabel('recurring.uncheckAll');

        onUpdate?.();
    });
}

// ============================================================================
// ADVANCED TOGGLE
// ============================================================================

/**
 * Setup advanced settings toggle
 * @param {Object} deps - Dependencies (getElementById, querySelectorAll, safeAddEventListener)
 */
export function setupAdvancedToggle(deps) {
    const toggleBtn = deps.getElementById(DOM_IDS.TOGGLE_ADVANCED_SETTINGS);
    if (!toggleBtn) return;

    let advancedVisible = false;

    const setAdvancedVisibility = (visible) => {
        advancedVisible = visible;
        toggleBtn.textContent = visible
            ? getLabel('recurring.hideAdvanced')
            : getLabel('recurring.showAdvanced');

        // Show/hide all `.frequency-options` panels
        deps.querySelectorAll(DOM_SELECTORS.FREQUENCY_OPTIONS).forEach(option => {
            option.style.display = visible ? "block" : "none";
        });

        // Always show frequency dropdown container
        const frequencyContainer = deps.getElementById(DOM_IDS.RECUR_FREQUENCY_CONTAINER);
        if (frequencyContainer) frequencyContainer.style.display = "block";

        // Handle extras like 'Recur indefinitely' and 'Specific Dates'
        const advancedControls = [
            { checkboxId: DOM_IDS.RECUR_INDEFINITELY },
            { checkboxId: DOM_IDS.RECUR_SPECIFIC_DATES }
        ];

        advancedControls.forEach(({ checkboxId }) => {
            const checkbox = deps.getElementById(checkboxId);
            if (!checkbox) return;

            const label = checkbox.closest("label");
            if (label) {
                label.style.display = visible ? "flex" : "none";
            }
        });

        const defaultBoxContainer = deps.getElementById(DOM_IDS.SET_DEFAULT_RECURRING_CONTAINER);
        if (defaultBoxContainer) {
            defaultBoxContainer.style.display = visible ? "block" : "none";
        }
    };

    setAdvancedVisibility(false);

    deps.safeAddEventListener(toggleBtn, "click", () => {
        setAdvancedVisibility(!advancedVisible);
    });

    // Expose reset for use when panel reopens
    return { resetAdvanced: () => setAdvancedVisibility(false) };
}

// ============================================================================
// TIME CONVERSION
// ============================================================================

/**
 * Setup time conversion between 12hr and 24hr formats
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 * @param {Object} config - { hourInputId, minuteInputId, meridiemSelectId, militaryCheckboxId }
 */
export function setupTimeConversion(deps, { hourInputId, minuteInputId, meridiemSelectId, militaryCheckboxId }) {
    const hourInput = deps.getElementById(hourInputId);
    const minuteInput = deps.getElementById(minuteInputId);
    const meridiemSelect = deps.getElementById(meridiemSelectId);
    const militaryToggle = deps.getElementById(militaryCheckboxId);

    if (!hourInput || !minuteInput || !meridiemSelect || !militaryToggle) return;

    deps.safeAddEventListener(militaryToggle, "change", () => {
        const is24Hour = militaryToggle.checked;
        let hour = parseInt(hourInput.value) || 0;
        let meridiem = meridiemSelect.value;

        if (is24Hour) {
            // Convert from 12h to 24h
            if (meridiem === "AM") {
                hour = hour === 12 ? 0 : hour;
            } else {
                hour = hour === 12 ? 12 : hour + 12;
            }
            hourInput.value = hour;
            meridiemSelect.classList.add("hidden");
        } else {
            // Convert from 24h to 12h
            if (hour === 0) {
                hourInput.value = 12;
                meridiemSelect.value = "AM";
            } else if (hour < 12) {
                hourInput.value = hour;
                meridiemSelect.value = "AM";
            } else if (hour === 12) {
                hourInput.value = 12;
                meridiemSelect.value = "PM";
            } else {
                hourInput.value = hour - 12;
                meridiemSelect.value = "PM";
            }
            meridiemSelect.classList.remove("hidden");
        }
    });
}

/**
 * Setup military time toggle for a frequency prefix
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 * @param {string} prefix - Frequency prefix (daily, weekly, etc.)
 * @param {Function} onUpdate - Callback when format changes
 */
export function setupMilitaryTimeToggle(deps, prefix, onUpdate) {
    const toggle = deps.getElementById(DOM_IDS.freqMilitary(prefix));
    const hourInput = deps.getElementById(DOM_IDS.freqHour(prefix));
    const meridiemSelect = deps.getElementById(DOM_IDS.freqMeridiem(prefix));

    if (!toggle || !hourInput || !meridiemSelect) {
        console.warn(`Missing elements for military time toggle: ${prefix}`);
        return;
    }

    deps.safeAddEventListener(toggle, "change", () => {
        const is24Hour = toggle.checked;

        try {
            hourInput.min = is24Hour ? 0 : 1;
            hourInput.max = is24Hour ? 23 : 12;
            meridiemSelect.classList.toggle("hidden", is24Hour);

            onUpdate?.();
        } catch (error) {
            console.warn(`Error updating military time toggle for ${prefix}:`, error);
        }
    });
}

// ============================================================================
// MONTHLY MUTUAL EXCLUSION
// ============================================================================

/**
 * Setup mutual exclusivity for monthly specific days vs week-of-month pattern
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 */
export function setupMonthlyMutualExclusion(deps) {
    const specificDays = deps.getElementById(DOM_IDS.MONTHLY_SPECIFIC_DAYS);
    const weekOfMonth = deps.getElementById(DOM_IDS.MONTHLY_WEEK_OF_MONTH);

    if (!specificDays || !weekOfMonth) return;

    deps.safeAddEventListener(specificDays, "change", () => {
        if (specificDays.checked && weekOfMonth.checked) {
            weekOfMonth.checked = false;
            const weekContainer = deps.getElementById(DOM_IDS.MONTHLY_WEEK_CONTAINER);
            if (weekContainer) weekContainer.classList.add("hidden");
        }
    });

    deps.safeAddEventListener(weekOfMonth, "change", () => {
        if (weekOfMonth.checked && specificDays.checked) {
            specificDays.checked = false;
            const dayContainer = deps.getElementById(DOM_IDS.MONTHLY_DAY_CONTAINER);
            if (dayContainer) dayContainer.classList.add("hidden");
        }
    });
}

// ============================================================================
// ADDITIONAL LISTENERS
// ============================================================================

/**
 * Setup additional event listeners for recurring panel
 * @param {Object} deps - Dependencies
 * @param {Object} callbacks - { updateRecurringSummary, updateRecurCountVisibility }
 */
export function setupAdditionalListeners(deps, callbacks) {
    // Specific date time checkbox
    const specificDateTime = deps.getElementById(DOM_IDS.SPECIFIC_DATE_SPECIFIC_TIME);
    if (specificDateTime) {
        deps.safeAddEventListener(specificDateTime, "change", (e) => {
            const timeContainer = deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME_CONTAINER);
            if (timeContainer) {
                timeContainer.classList.toggle("hidden", !e.target.checked);
            }
            callbacks.updateRecurringSummary?.();
        });
    }

    // Duration radio buttons summary update
    [DOM_IDS.RECUR_INDEFINITELY, DOM_IDS.RECUR_COUNT_RADIO, DOM_IDS.RECUR_UNTIL_RADIO].forEach(id => {
        const radio = deps.getElementById(id);
        if (radio) {
            deps.safeAddEventListener(radio, "change", () => {
                callbacks.updateRecurCountVisibility?.();
                callbacks.updateRecurringSummary?.();
            });
        }
    });

    // Document click handler for deselecting task when clicking outside
    deps.safeAddEventListener(document, "click", (e) => {
        const overlay = deps.getModal('recurringOverlay');
        if (!overlay || !overlay.open) return;

        const taskList = deps.getElementById(DOM_IDS.RECURRING_TASK_LIST);
        const settingsPanel = deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
        const summaryPreview = deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);

        if (taskList?.contains(e.target) || settingsPanel?.contains(e.target)) return;

        // Deselect task and return to browsing when clicking outside
        if (summaryPreview && !summaryPreview.contains(e.target) && !taskList?.contains(e.target)) {
            deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
                el.classList.remove("selected");
                el.setAttribute("aria-selected", "false");
            });
            callbacks.deselectAndBrowse?.();
        }
    });
}

