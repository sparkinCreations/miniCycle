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

import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, LIMITS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { ICONS } from '../utils/icons.js';
import { handleHorizontalArrowNav } from '../utils/keyboardNav.js';
import { formatLocalDate } from './recurringDateUtils.js';

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
        const val = parseInt(minuteInput.value);
        if (isNaN(val)) return;
        if (val > 59) { minuteInput.value = 0; onUpdate?.(); }
        else if (val < 0) { minuteInput.value = 59; onUpdate?.(); }
        else { onUpdate?.(); }
    });
    deps.safeAddEventListener(minuteInput, 'blur', () => {
        const val = parseInt(minuteInput.value);
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



// ============================================================================
// SPECIFIC DATES / BIWEEKLY / DURATION / SUMMARY LISTENERS
// ============================================================================
// Extracted from recurringPanel.js (Aug 2026) — the four setup methods the
// original refactor left behind. Same deps-as-parameters shape as the helpers
// above; the panel keeps thin wrappers that pass its own resolved DI and bind
// its instance methods as callbacks.

/**
 * Setup the specific-dates panel: the checkbox that swaps the whole frequency
 * UI for a date list, plus adding/removing individual date inputs.
 *
 * The largest of these helpers, and the reason it stayed inline longest.
 *
 * @param {Object} deps - getElementById, safeAddEventListener, querySelectorAll, showNotification
 * @param {Object} callbacks - { getTomorrow, updateRecurringSummary, updateRecurCountVisibility }
 * @returns {void}
 */
export function setupSpecificDatesPanel(deps, callbacks) {
    const checkbox = deps.getElementById(DOM_IDS.RECUR_SPECIFIC_DATES);
    const panel = deps.getElementById(DOM_IDS.SPECIFIC_DATES_PANEL);
    const timeOptions = deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME_OPTIONS);
    const addBtn = deps.getElementById(DOM_IDS.ADD_SPECIFIC_DATE);
    const list = deps.getElementById(DOM_IDS.SPECIFIC_DATE_LIST);

    if (!checkbox || !panel || !timeOptions || !addBtn || !list) {
        console.warn("⚠️ Missing elements for specific dates panel setup");
        return;
    }

    const createDateInput = (isFirst = false) => {
        const wrapper = document.createElement("div");
        wrapper.className = "specific-date-item";

        const input = document.createElement("input");
        input.type = "date";
        const index = list.children.length;
        const inputId = `specific-date-input-${Date.now()}-${index}`;
        input.id = inputId;
        input.name = `specificDate${index}`;
        input.setAttribute("aria-label", isFirst ? getLabel('recurring.firstSpecificDate') : getLabel('recurring.specificDate', { vars: { index: index + 1 } }));
        input.required = true;

        // Assign `value` from a locally-formatted string, NOT `valueAsDate`.
        // valueAsDate is a UTC setter: it renders the instant's UTC calendar
        // day. getTomorrow() is local, so in any negative offset an evening
        // "tomorrow" is already the day after in UTC, and the input defaulted
        // TWO days out. Measured Aug 2026: wrong from 20:00 EDT / 17:00 PDT
        // onward, silent, and a user who accepts the default schedules the
        // recurrence a day late.
        try {
            input.value = formatLocalDate(callbacks.getTomorrow()) ?? '';
        } catch (error) {
            console.warn("⚠️ Could not set default date:", error);
        }

        if (isFirst) {
            input.classList.add(DOM_CLASSES.FIRST_SPECIFIC_DATE);
        }

        deps.safeAddEventListener(input, "change", () => {
            if (isFirst && !input.value) {
                try {
                    // Same UTC hazard as the default above — local format only.
                    input.value = formatLocalDate(callbacks.getTomorrow()) ?? '';
                } catch (error) {
                    console.warn("⚠️ Could not reset date:", error);
                }
            }
            callbacks.updateRecurringSummary?.();
        });

        wrapper.appendChild(input);

        if (!isFirst) {
            const trash = document.createElement("button");
            trash.type = "button";
            trash.className = "trash-btn";
            trash.innerHTML = `<span class="icon recurring-date-trash-icon" aria-hidden="true">${ICONS['trash']}</span>`;
            trash.title = getLabel('recurring.removeDate');

            deps.safeAddEventListener(trash, "click", () => {
                wrapper.remove();
                callbacks.updateRecurCountVisibility?.();
                callbacks.updateRecurringSummary?.();
            });
            wrapper.appendChild(trash);
        }

        list.appendChild(wrapper);
        callbacks.updateRecurringSummary?.();
    };

    deps.safeAddEventListener(checkbox, "change", () => {
        const shouldShow = checkbox.checked;

        panel.classList.toggle(DOM_CLASSES.HIDDEN, !shouldShow);
        timeOptions.classList.toggle(DOM_CLASSES.HIDDEN, !shouldShow);

        deps.querySelectorAll(DOM_SELECTORS.FREQUENCY_OPTIONS).forEach(panel => {
            panel.classList.add(DOM_CLASSES.HIDDEN);
        });

        // Hide the surfaced time picker section when specific dates is active
        const timePickerSection = deps.getElementById(DOM_IDS.TIME_PICKER_SECTION);
        if (timePickerSection) {
            timePickerSection.classList.toggle(DOM_CLASSES.HIDDEN, shouldShow);
        }

        deps.getElementById(DOM_IDS.RECUR_FREQUENCY_CONTAINER).classList.toggle(DOM_CLASSES.HIDDEN, shouldShow);
        deps.getElementById(DOM_IDS.RECUR_INDEFINITELY).closest("label").classList.toggle(DOM_CLASSES.HIDDEN, shouldShow);

        const advancedBtn = deps.getElementById(DOM_IDS.TOGGLE_ADVANCED_SETTINGS);
        if (advancedBtn) {
            advancedBtn.classList.toggle(DOM_CLASSES.HIDDEN, shouldShow);
        }

        if (shouldShow && list.children.length === 0) {
            createDateInput(true);
        }

        if (!shouldShow) {
            deps.getElementById(DOM_IDS.SPECIFIC_DATE_SPECIFIC_TIME).checked = false;
            deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME_CONTAINER).classList.add(DOM_CLASSES.HIDDEN);

            const freqSelect = deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
            if (freqSelect) {
                const event = new Event("change");
                freqSelect.dispatchEvent(event);
            }

            // Only restore "Recur indefinitely" label if advanced options are expanded
            const advBtn = deps.getElementById(DOM_IDS.TOGGLE_ADVANCED_SETTINGS);
            const advancedOn = advBtn?.dataset.advancedVisible === 'true';
            const indefinitelyLabel = deps.getElementById(DOM_IDS.RECUR_INDEFINITELY)?.closest("label");
            if (indefinitelyLabel && !advancedOn) {
                indefinitelyLabel.classList.add(DOM_CLASSES.HIDDEN);
            }
        }

        callbacks.updateRecurCountVisibility?.();
        callbacks.updateRecurringSummary?.();
    });

    deps.safeAddEventListener(addBtn, "click", () => {
        // Refuse past the cap and say so, rather than adding silently.
        // The .mcyc importer truncates to the same LIMITS.MAX_SPECIFIC_DATES;
        // before this the panel had no cap at all, so the two producers for
        // the same field disagreed (REVIEW_PATTERNS.md §4).
        if (list.children.length >= LIMITS.MAX_SPECIFIC_DATES) {
            deps.showNotification(
                getLabel('notify.specificDatesLimit', { vars: { limit: LIMITS.MAX_SPECIFIC_DATES } }),
                'info',
                UI_TIMEOUTS.NOTIFICATION_SHORT
            );
            return;
        }
        createDateInput(false);
    });

    callbacks.updateRecurringSummary?.();
}

/**
 * Setup the biweekly Week 1 / Week 2 day pickers (delegated click + keyboard).
 * @param {Object} deps - querySelectorAll, safeAddEventListener
 * @returns {void}
 */
export function setupBiweeklyDayToggle(deps) {
    // Delegated handlers on each .biweekly-days group (Week 1, Week 2)
    deps.querySelectorAll(DOM_SELECTORS.BIWEEKLY_DAYS).forEach(container => {
        deps.safeAddEventListener(container, "click", (e) => {
            const box = e.target.closest(DOM_SELECTORS.BIWEEKLY_DAY_BOX);
            if (!box) return;
            box.classList.toggle(DOM_CLASSES.SELECTED);
            box.setAttribute("aria-checked", box.classList.contains(DOM_CLASSES.SELECTED) ? "true" : "false");
        });
        deps.safeAddEventListener(container, "keydown", (e) => {
            const box = e.target.closest(DOM_SELECTORS.BIWEEKLY_DAY_BOX);
            if (!box) return;
            // Arrow key navigation between day boxes
            if (handleHorizontalArrowNav(e, container, DOM_SELECTORS.BIWEEKLY_DAY_BOX, { wrap: false })) return;
            // Enter/Space to toggle selection
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                box.classList.toggle(DOM_CLASSES.SELECTED);
                box.setAttribute("aria-checked", box.classList.contains(DOM_CLASSES.SELECTED) ? "true" : "false");
            }
        });
    });
}

/**
 * Setup the duration controls: the indefinitely checkbox and the count/until
 * radio pair, including their initial visibility.
 * @param {Object} deps - getElementById, safeAddEventListener
 * @returns {void}
 */
export function setupDurationRadioButtons(deps) {
    const indefinitelyCheckbox = deps.getElementById(DOM_IDS.RECUR_INDEFINITELY);
    const limitedContainer = deps.getElementById(DOM_IDS.RECUR_LIMITED_CONTAINER);
    const countRadio = deps.getElementById(DOM_IDS.RECUR_COUNT_RADIO);
    const untilRadio = deps.getElementById(DOM_IDS.RECUR_UNTIL_RADIO);
    const countContainer = deps.getElementById(DOM_IDS.RECUR_COUNT_CONTAINER);
    const untilContainer = deps.getElementById(DOM_IDS.RECUR_UNTIL_CONTAINER);

    if (!indefinitelyCheckbox || !limitedContainer) return;

    // Handle indefinitely checkbox
    const updateLimitedVisibility = () => {
        if (indefinitelyCheckbox.checked) {
            limitedContainer.classList.add(DOM_CLASSES.HIDDEN);
        } else {
            limitedContainer.classList.remove(DOM_CLASSES.HIDDEN);
            // Trigger radio button update
            updateDurationContainers();
        }
    };

    // Handle radio buttons within limited container
    const updateDurationContainers = () => {
        if (countRadio && countContainer) {
            countContainer.classList.toggle(DOM_CLASSES.HIDDEN, !countRadio.checked);
        }
        if (untilRadio && untilContainer) {
            untilContainer.classList.toggle(DOM_CLASSES.HIDDEN, !untilRadio.checked);
        }
    };

    deps.safeAddEventListener(indefinitelyCheckbox, "change", updateLimitedVisibility);
    if (countRadio) deps.safeAddEventListener(countRadio, "change", updateDurationContainers);
    if (untilRadio) deps.safeAddEventListener(untilRadio, "change", updateDurationContainers);

    // Initialize visibility on load
    updateLimitedVisibility();
}

/**
 * Re-render the summary on any change or click inside the settings panel.
 * @param {Object} deps - getElementById, safeAddEventListener
 * @param {Object} callbacks - { updateRecurringSummary }
 * @returns {void}
 */
export function attachRecurringSummaryListeners(deps, callbacks) {
    if (!deps.safeAddEventListener) return; // Guard: dependency not injected (e.g., in tests)

    try {
        const panel = deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
        if (!panel) {
            console.warn('⚠️ Recurring settings panel not found');
            return;
        }

        // Listen for changes in the panel
        deps.safeAddEventListener(panel, "change", () => callbacks.updateRecurringSummary?.());
        deps.safeAddEventListener(panel, "click", () => callbacks.updateRecurringSummary?.());

    } catch (error) {
        console.error('❌ Error attaching summary listeners:', error);
    }
}
