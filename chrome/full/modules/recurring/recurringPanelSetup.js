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

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Build a map of frequency keys to their DOM option panels
 * @param {Object} deps - Dependencies (getElementById)
 * @returns {Object} frequencyMap - { hourly: Element, daily: Element, ... }
 */
function getFrequencyOptionMap(deps) {
    return {
        hourly: deps.getElementById(DOM_IDS.HOURLY_OPTIONS),
        daily: deps.getElementById(DOM_IDS.DAILY_OPTIONS),
        weekly: deps.getElementById(DOM_IDS.WEEKLY_OPTIONS),
        biweekly: deps.getElementById(DOM_IDS.BIWEEKLY_OPTIONS),
        monthly: deps.getElementById(DOM_IDS.MONTHLY_OPTIONS),
        yearly: deps.getElementById(DOM_IDS.YEARLY_OPTIONS)
    };
}

// ============================================================================
// FREQUENCY SELECTOR
// ============================================================================

/**
 * Setup frequency selector dropdown
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 * @param {Function} onUpdate - Callback when frequency changes
 * @returns {void}
 */
export function setupFrequencySelector(deps, onUpdate) {
    const frequencySelect = deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
    if (!frequencySelect) return;

    deps.safeAddEventListener(frequencySelect, "change", () => {
        const selectedFrequency = frequencySelect.value;
        const frequencyMap = getFrequencyOptionMap(deps);

        // Hide all frequency option sections
        Object.values(frequencyMap).forEach(section => {
            if (section) section.classList.add(DOM_CLASSES.HIDDEN);
        });

        // Show selected frequency options only if advanced toggle is visible
        const advToggleBtn = deps.getElementById(DOM_IDS.TOGGLE_ADVANCED_SETTINGS);
        const advancedOn = advToggleBtn?.dataset.advancedVisible === 'true';
        if (frequencyMap[selectedFrequency] && advancedOn) {
            frequencyMap[selectedFrequency].classList.remove(DOM_CLASSES.HIDDEN);
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
            if (section) section.classList.add(DOM_CLASSES.HIDDEN);
        });

        if (timeMap[selectedFrequency]) {
            timeMap[selectedFrequency].classList.remove(DOM_CLASSES.HIDDEN);
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
 * @returns {void}
 */
export function setupToggleVisibility(deps) {
    const toggleVisibility = (triggerId, contentId) => {
        const trigger = deps.getElementById(triggerId);
        const content = deps.getElementById(contentId);
        if (trigger && content) {
            deps.safeAddEventListener(trigger, "change", () => {
                content.classList.toggle(DOM_CLASSES.HIDDEN, !trigger.checked);
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
 * @returns {void}
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
                item.classList.toggle(DOM_CLASSES.CHECKED, anyUnchecked);
            }
        });

        // Update button label
        toggleBtn.textContent = anyUnchecked ? getLabel('recurring.uncheckAll') : getLabel('recurring.checkAll');

        onUpdate?.();
    });
}

// ============================================================================
// ADVANCED TOGGLE
// ============================================================================

/**
 * Setup advanced settings toggle
 * @param {Object} deps - Dependencies (getElementById, querySelectorAll, safeAddEventListener)
 * @returns {{resetAdvanced: Function}|undefined} Object with resetAdvanced callback, or undefined if toggle element not found
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

        // Track state so frequency selector can check it
        toggleBtn.dataset.advancedVisible = String(visible);

        // Show/hide all `.frequency-options` panels
        deps.querySelectorAll(DOM_SELECTORS.FREQUENCY_OPTIONS).forEach(option => {
            option.classList.toggle(DOM_CLASSES.HIDDEN, !visible);
        });

        // Re-apply frequency selection so only the active frequency's options show
        if (visible) {
            const frequencySelect = deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
            if (frequencySelect) {
                const selected = frequencySelect.value;
                const frequencyMap = getFrequencyOptionMap(deps);

                Object.entries(frequencyMap).forEach(([freq, section]) => {
                    if (section && freq !== selected) {
                        section.classList.add(DOM_CLASSES.HIDDEN);
                    }
                });
            }
        }

        // Always show frequency dropdown container
        const frequencyContainer = deps.getElementById(DOM_IDS.RECUR_FREQUENCY_CONTAINER);
        if (frequencyContainer) frequencyContainer.classList.remove(DOM_CLASSES.HIDDEN);

        // Handle extras like 'Recur indefinitely' (Specific Dates is always visible — top-level setting)
        const advancedControls = [
            { checkboxId: DOM_IDS.RECUR_INDEFINITELY },
        ];

        advancedControls.forEach(({ checkboxId }) => {
            const checkbox = deps.getElementById(checkboxId);
            if (!checkbox) return;

            const label = checkbox.closest("label");
            if (label) {
                label.classList.toggle(DOM_CLASSES.HIDDEN, !visible);
            }
        });

        const defaultBoxContainer = deps.getElementById(DOM_IDS.SET_DEFAULT_RECURRING_CONTAINER);
        if (defaultBoxContainer) {
            defaultBoxContainer.classList.toggle(DOM_CLASSES.HIDDEN, !visible);
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
// TIME INPUT WRAP-AROUND
// ============================================================================
// Note: per-frequency time-of-day now uses a native <input type="time"> (see
// modalTemplates.js), which handles 12/24h display, meridiem, and wrap-around
// natively. Only the hourly "specific minute" case still uses a number input.

/**
 * Setup wrap-around for the hourly-only minute input.
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 * @param {Function} [onUpdate] - Callback after value changes
 * @returns {void}
 */
export function setupHourlyMinuteWrapping(deps, onUpdate) {
    const minuteInput = deps.getElementById(DOM_IDS.HOURLY_MINUTE);
    if (!minuteInput) return;

    deps.safeAddEventListener(minuteInput, 'input', () => {
        let val = parseInt(minuteInput.value);
        if (isNaN(val)) return;
        if (val > 59) { minuteInput.value = 0; onUpdate?.(); }
        else if (val < 0) { minuteInput.value = 59; onUpdate?.(); }
        else { onUpdate?.(); }
    });
    deps.safeAddEventListener(minuteInput, 'blur', () => {
        let val = parseInt(minuteInput.value);
        if (isNaN(val) || minuteInput.value === '') return;
        minuteInput.value = Math.max(0, Math.min(val, 59));
    });
}

// ============================================================================
// MONTHLY MUTUAL EXCLUSION
// ============================================================================

/**
 * Setup mutual exclusivity for monthly specific days vs week-of-month pattern
 * @param {Object} deps - Dependencies (getElementById, safeAddEventListener)
 * @returns {void}
 */
export function setupMonthlyMutualExclusion(deps) {
    const specificDays = deps.getElementById(DOM_IDS.MONTHLY_SPECIFIC_DAYS);
    const weekOfMonth = deps.getElementById(DOM_IDS.MONTHLY_WEEK_OF_MONTH);

    if (!specificDays || !weekOfMonth) return;

    deps.safeAddEventListener(specificDays, "change", () => {
        if (specificDays.checked && weekOfMonth.checked) {
            weekOfMonth.checked = false;
            const weekContainer = deps.getElementById(DOM_IDS.MONTHLY_WEEK_CONTAINER);
            if (weekContainer) weekContainer.classList.add(DOM_CLASSES.HIDDEN);
        }
    });

    deps.safeAddEventListener(weekOfMonth, "change", () => {
        if (weekOfMonth.checked && specificDays.checked) {
            specificDays.checked = false;
            const dayContainer = deps.getElementById(DOM_IDS.MONTHLY_DAY_CONTAINER);
            if (dayContainer) dayContainer.classList.add(DOM_CLASSES.HIDDEN);
        }
    });
}

// ============================================================================
// ADDITIONAL LISTENERS
// ============================================================================

/**
 * Setup additional event listeners for recurring panel
 * @param {Object} deps - Dependencies
 * @param {Object} callbacks - { updateRecurringSummary, updateRecurCountVisibility, deselectAndBrowse }
 * @returns {void}
 */
export function setupAdditionalListeners(deps, callbacks) {
    // Specific date time checkbox
    const specificDateTime = deps.getElementById(DOM_IDS.SPECIFIC_DATE_SPECIFIC_TIME);
    if (specificDateTime) {
        deps.safeAddEventListener(specificDateTime, "change", (e) => {
            const timeContainer = deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME_CONTAINER);
            if (timeContainer) {
                timeContainer.classList.toggle(DOM_CLASSES.HIDDEN, !e.target.checked);
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
        const addSection = deps.getElementById(DOM_IDS.ADD_RECURRING_TASK_SECTION);
        const toggleActions = deps.getElementById(DOM_IDS.RECURRING_TOGGLE_ACTIONS);

        if (taskList?.contains(e.target) || settingsPanel?.contains(e.target)) return;
        if (addSection?.contains(e.target)) return;
        if (toggleActions?.contains(e.target)) return;
        if (e.target.closest(DOM_SELECTORS.NOTIFICATION)) return;

        // Deselect task and return to browsing when clicking outside
        if (summaryPreview && !summaryPreview.contains(e.target) && !taskList?.contains(e.target)) {
            deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
                el.classList.remove(DOM_CLASSES.SELECTED);
                el.setAttribute("aria-selected", "false");
            });
            callbacks.deselectAndBrowse?.();
        }
    });
}

