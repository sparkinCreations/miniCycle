/**
 * miniCycle Recurring Tasks - UI Panel Manager
 *
 * Handles UI management for the recurring task settings panel.
 * Uses strict dependency injection - all dependencies must be injected.
 *
 * Features:
 * - Recurring task panel rendering
 * - Form population and validation
 * - Settings panel visibility management
 * - Summary text generation
 * - Button visibility management
 *
 * @module recurring/recurringPanel
 * @version 1.0.0
 * @see {@link module:recurring/recurringCore} - Core calculation logic
 * @see {@link module:recurring/recurringWatcher} - Task watcher
 */

/**
 * @typedef {import('../core/types.js').Task} Task
 * @typedef {import('../core/types.js').RecurringSettings} RecurringSettings
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS } from '../core/constants.js';
import { ICONS } from '../utils/icons.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('RecurringPanel', {
    // Required — always wired by integration, panel cannot function without these
    AppState: required(),
    showNotification: required(),
    applyRecurringSettings: required(),
    normalizeRecurringSettings: required(),
    calculateNextOccurrence: required(),
    deleteTemplate: required(),
    buildRecurringSummary: required(),
    formatNextOccurrence: required(),
    updateAppState: required(),
    showConfirmationModal: required(),
    getElementById: required(),
    querySelector: required(),
    querySelectorAll: required(),

    // Optional — genuinely nullable, code checks before use
    appInit: optional(null),
    loadData: optional(null),
    escapeHtml: optional(null),
    syncRecurringStateToDOM: optional(null),
    refreshTaskButtonsForModeChange: optional(null),
    safeAddEventListener: optional(null),
    refreshUIFromState: optional(null),
    activateTaskRecurringState: optional(null),
    deactivateTaskRecurringState: optional(null),
    getModal: optional(null)
}, { strict: true });

/**
 * Set dependencies for RecurringPanel module
 * Must be called before creating RecurringPanelManager instances
 */
export function setRecurringPanelDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================
// RECURRING PANEL MANAGER CLASS
// ============================================

/**
 * RecurringPanelManager - Manages the recurring tasks UI panel
 * Uses Strict DI pattern - throws on missing required dependencies
 */
export class RecurringPanelManager {
    constructor(dependencies = {}) {
        console.log('🎛️ Initializing RecurringPanelManager...');

        // Resolve and spread — schema defines required vs optional, no manual mapping needed
        this.deps = { ...di.resolve(dependencies) };

        // Internal state
        this.state = {
            isInitialized: false,
            panelOpen: false,
            selectedTaskId: null,
            selectedYearlyDays: {} // key = month number, value = array of selected days
        };

        // ✅ MEMORY LEAK FIX: Track event delegation initialization
        this._eventDelegationInitialized = false;

        console.log('✅ RecurringPanelManager initialized');
    }

    // ============================================
    // EVENT DELEGATION (MEMORY LEAK FIX)
    // ============================================

    /**
     * Initialize event delegation for all repeated elements
     * ✅ MEMORY LEAK FIX: Replaces 35-60+ anonymous listeners with ~5 delegated listeners
     */
    initEventDelegation() {
        const callbacks = {
            handleRemoveTask: (template, item) => this.handleRemoveTask(template, item),
            showTaskSummaryPreview: (task) => this.showTaskSummaryPreview(task),
            getSelectedYearlyMonths: () => this.getSelectedYearlyMonths()
        };
        _initEventDelegation(this.deps, this.state, callbacks);
    }

    // NOTE: Individual delegation methods (setupMonthlyDayDelegation, setupWeeklyDayDelegation, etc.)
    // have been consolidated into recurringPanelEvents.js module.
    // The initEventDelegation() method above delegates to that module.

    // ============================================
    // ============================================
    // PANEL INITIALIZATION
    // ============================================

    /**
     * Setup the recurring panel with event listeners
     * Should be called once during app initialization
     */
    setup() {
        console.log('⚙️ Setting up recurring panel...');

        // Inject form actions for callback pattern
        if (_formModule?.setFormActions) {
            _formModule.setFormActions({
                updateRecurringSummary: () => this.updateRecurringSummary(),
                normalizeRecurringSettings: (settings) => this.deps.normalizeRecurringSettings?.(settings) || settings
            });
        }

        try {
            const overlay = this.deps.getModal('recurringOverlay');
            const panel = this.deps.getModal('recurringPanel');
            const closeBtn = this.deps.getElementById(DOM_IDS.CLOSE_RECURRING_PANEL);
            const openBtn = this.deps.getElementById(DOM_IDS.OPEN_RECURRING_PANEL);

            if (!overlay || !panel || !closeBtn || !openBtn) {
                console.warn('⚠️ Recurring panel elements not found in DOM');
                return;
            }

            // Open panel button
            this.deps.safeAddEventListener(openBtn, "click", () => {
                this.deps.trackAction?.('recurring');
                this.openPanel();
            });

            // Close panel button
            this.deps.safeAddEventListener(closeBtn, "click", () => this.closePanel());

            // Close on overlay click
            this.deps.safeAddEventListener(overlay, "click", (e) => {
                if (e.target === overlay) {
                    this.closePanel();
                }
            });

            // Restore focus when dialog closes (including native ESC)
            this.deps.safeAddEventListener(overlay, "close", () => {
                overlay._previousFocus?.focus();
            });

            // Setup change recurring settings button
            const changeSettingsBtn = this.deps.getElementById(DOM_IDS.CHANGE_RECURRING_SETTINGS);
            if (changeSettingsBtn) {
                this.deps.safeAddEventListener(changeSettingsBtn, "click", () => {
                    console.log('🔧 Change recurring settings clicked');
                    if (this.state.selectedTaskId) {
                        this.openRecurringSettingsPanelForTask(this.state.selectedTaskId);
                    } else {
                        console.warn('⚠️ No task selected for changing settings');
                    }
                });
            }

            // Setup frequency selector
            this.setupFrequencySelector();

            // Setup toggle visibility checkboxes
            this.setupToggleVisibility();

            // Setup toggle check all button
            this.setupToggleCheckAll();

            // Setup advanced settings toggle
            this.setupAdvancedToggle();

            // Setup time conversion for all frequencies
            this.setupTimeConversion({
                hourInputId: "specific-date-hour",
                minuteInputId: "specific-date-minute",
                meridiemSelectId: "specific-date-meridiem",
                militaryCheckboxId: "specific-date-military"
            });
            this.setupTimeConversion({
                hourInputId: "daily-hour",
                minuteInputId: "daily-minute",
                meridiemSelectId: "daily-meridiem",
                militaryCheckboxId: "daily-military"
            });
            this.setupTimeConversion({
                hourInputId: "weekly-hour",
                minuteInputId: "weekly-minute",
                meridiemSelectId: "weekly-meridiem",
                militaryCheckboxId: "weekly-military"
            });
            this.setupTimeConversion({
                hourInputId: "biweekly-hour",
                minuteInputId: "biweekly-minute",
                meridiemSelectId: "biweekly-meridiem",
                militaryCheckboxId: "biweekly-military"
            });
            this.setupTimeConversion({
                hourInputId: "monthly-hour",
                minuteInputId: "monthly-minute",
                meridiemSelectId: "monthly-meridiem",
                militaryCheckboxId: "monthly-military"
            });
            this.setupTimeConversion({
                hourInputId: "yearly-hour",
                minuteInputId: "yearly-minute",
                meridiemSelectId: "yearly-meridiem",
                militaryCheckboxId: "yearly-military"
            });

            // Setup military time toggles
            this.setupMilitaryTimeToggle("daily");
            this.setupMilitaryTimeToggle("weekly");
            this.setupMilitaryTimeToggle("biweekly");
            this.setupMilitaryTimeToggle("monthly");
            this.setupMilitaryTimeToggle("yearly");

            // Setup day/week/month grids
            this.setupWeeklyDayToggle();
            this.generateMonthlyDayGrid();
            this.generateYearlyMonthGrid();

            // Setup yearly options
            const yearlyMonthSelect = this.deps.getElementById(DOM_IDS.YEARLY_MONTH_SELECT);
            if (yearlyMonthSelect) {
                this.deps.safeAddEventListener(yearlyMonthSelect, "change", (e) => {
                    const selectedMonth = parseInt(e.target.value);
                    this.generateYearlyDayGrid(selectedMonth);
                });
                this.generateYearlyDayGrid(1);
            }

            const yearlyApplyToAllCheckbox = this.deps.getElementById(DOM_IDS.YEARLY_APPLY_DAYS_TO_ALL);
            if (yearlyApplyToAllCheckbox) {
                this.deps.safeAddEventListener(yearlyApplyToAllCheckbox, "change", () => {
                    this.handleYearlyApplyToAllChange();
                });
            }

            const yearlySpecificDaysCheckbox = this.deps.getElementById(DOM_IDS.YEARLY_SPECIFIC_DAYS);
            const yearlyDayContainer = this.deps.getElementById(DOM_IDS.YEARLY_DAY_CONTAINER);
            if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
                this.deps.safeAddEventListener(yearlySpecificDaysCheckbox, "change", () => {
                    const hasMonthSelected = this.getSelectedYearlyMonths().length > 0;
                    yearlyDayContainer.classList.toggle("hidden", !yearlySpecificDaysCheckbox.checked || !hasMonthSelected);
                });
            }

            // Setup specific dates panel
            this.setupSpecificDatesPanel();

            // Setup biweekly day toggle
            this.setupBiweeklyDayToggle();

            // Setup additional event listeners
            this.setupAdditionalListeners();

            // Setup apply/cancel button handlers
            this.setupApplyCancelButtons();

            // Attach summary listeners
            this.attachRecurringSummaryListeners();

            // ✅ MEMORY LEAK FIX: Initialize event delegation for all repeated elements
            this.initEventDelegation();

            // Setup add task section
            this.setupAddTaskSection();

            this.state.isInitialized = true;
            console.log('✅ Recurring panel setup complete');

        } catch (error) {
            console.error('❌ Error setting up recurring panel:', error);
            this.deps.showNotification(getLabel('notify.panelSetupFailed'), 'warning');
        }
    }

    /**
     * Setup frequency selector dropdown
     * Delegates to recurringPanelSetup module
     */
    setupFrequencySelector() {
        _setupFrequencySelector(this.deps, () => this.updateRecurringSummary());
    }

    /**
     * Setup toggle visibility for various sections
     * Delegates to recurringPanelSetup module
     */
    setupToggleVisibility() {
        _setupToggleVisibility(this.deps);

        // Setup duration radio buttons (kept in class - has local state)
        this.setupDurationRadioButtons();

        // Setup mutual exclusivity for monthly options
        this.setupMonthlyMutualExclusion();
    }

    /**
     * Setup toggle check all button
     * Delegates to recurringPanelSetup module
     */
    setupToggleCheckAll() {
        _setupToggleCheckAll(this.deps, () => this.updateRecurringSummary());
    }

    /**
     * Setup advanced settings toggle
     * Delegates to recurringPanelSetup module
     */
    setupAdvancedToggle() {
        _setupAdvancedToggle(this.deps);
    }

    /**
     * Setup time conversion between 12hr and 24hr formats
     * Delegates to recurringPanelSetup module
     */
    setupTimeConversion(config) {
        _setupTimeConversion(this.deps, config);
    }

    /**
     * Setup military time toggle for a frequency prefix
     * Delegates to recurringPanelSetup module
     */
    setupMilitaryTimeToggle(prefix) {
        _setupMilitaryTimeToggle(this.deps, prefix, () => this.updateRecurringSummary());
    }

    /**
     * Generate monthly day selection grid (1-31)
     * ✅ MEMORY LEAK FIX: No longer adds individual listeners - uses event delegation
     */
    generateMonthlyDayGrid() {
        _generateMonthlyDayGrid(this.deps);
    }

    /**
     * Setup weekly day toggle handlers
     * ✅ MEMORY LEAK FIX: No longer adds individual listeners - uses event delegation
     */
    setupWeeklyDayToggle() {
        // ✅ NO listeners added - handled by recurringPanelEvents.js delegation
        // This method kept for backward compatibility but does nothing
    }

    /**
     * Generate yearly month selection grid
     * ✅ MEMORY LEAK FIX: No longer adds individual listeners - uses event delegation
     */
    generateYearlyMonthGrid() {
        _generateYearlyMonthGrid(this.deps);
    }

    /**
     * Generate yearly day grid for a specific month
     * ✅ MEMORY LEAK FIX: No longer adds individual listeners - uses event delegation
     */
    generateYearlyDayGrid(monthNumber) {
        _generateYearlyDayGrid(this.deps, this.state, monthNumber);
    }

    /**
     * Handle yearly "apply to all months" checkbox change
     */
    handleYearlyApplyToAllChange() {
        const checkbox = this.deps.getElementById(DOM_IDS.YEARLY_APPLY_DAYS_TO_ALL);
        const dropdown = this.deps.getElementById(DOM_IDS.YEARLY_MONTH_SELECT);
        const selectedMonths = this.getSelectedYearlyMonths();

        if (!checkbox || !dropdown) return;

        if (checkbox.checked) {
            dropdown.classList.add("hidden");
            if (selectedMonths.length > 0) {
                this.generateYearlyDayGrid(selectedMonths[0]); // Use any selected month for grid
            }
        } else {
            dropdown.classList.remove("hidden");
            const selectedMonth = parseInt(dropdown.value);
            this.generateYearlyDayGrid(selectedMonth);
        }
    }

    /**
     * Get selected yearly months
     */
    getSelectedYearlyMonths() {
        return _getSelectedYearlyMonthsForm(this.deps);
    }

    /**
     * Get selected monthly days
     */
    getSelectedMonthlyDays() {
        return _getSelectedMonthlyDays(this.deps);
    }

    /**
     * Setup specific dates panel
     */
    setupSpecificDatesPanel() {
        const checkbox = this.deps.getElementById(DOM_IDS.RECUR_SPECIFIC_DATES);
        const panel = this.deps.getElementById(DOM_IDS.SPECIFIC_DATES_PANEL);
        const timeOptions = this.deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME_OPTIONS);
        const addBtn = this.deps.getElementById(DOM_IDS.ADD_SPECIFIC_DATE);
        const list = this.deps.getElementById(DOM_IDS.SPECIFIC_DATE_LIST);

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

            try {
                input.valueAsDate = this.getTomorrow();
            } catch (error) {
                console.warn("⚠️ Could not set default date:", error);
            }

            if (isFirst) {
                input.classList.add("first-specific-date");
            }

            this.deps.safeAddEventListener(input, "change", () => {
                if (isFirst && !input.value) {
                    try {
                        input.valueAsDate = this.getTomorrow();
                    } catch (error) {
                        console.warn("⚠️ Could not reset date:", error);
                    }
                }
                this.updateRecurringSummary();
            });

            wrapper.appendChild(input);

            if (!isFirst) {
                const trash = document.createElement("button");
                trash.type = "button";
                trash.className = "trash-btn";
                trash.innerHTML = `<span class="icon recurring-date-trash-icon" aria-hidden="true">${ICONS['trash']}</span>`;
                trash.title = getLabel('recurring.removeDate');

                this.deps.safeAddEventListener(trash, "click", () => {
                    wrapper.remove();
                    this.updateRecurCountVisibility();
                    this.updateRecurringSummary();
                });
                wrapper.appendChild(trash);
            }

            list.appendChild(wrapper);
            this.updateRecurringSummary();
        };

        this.deps.safeAddEventListener(checkbox, "change", () => {
            const shouldShow = checkbox.checked;

            panel.classList.toggle("hidden", !shouldShow);
            timeOptions.classList.toggle("hidden", !shouldShow);

            this.deps.querySelectorAll(DOM_SELECTORS.FREQUENCY_OPTIONS).forEach(panel => {
                panel.classList.add("hidden");
            });

            this.deps.getElementById(DOM_IDS.RECUR_FREQUENCY_CONTAINER).classList.toggle("hidden", shouldShow);
            this.deps.getElementById(DOM_IDS.RECUR_INDEFINITELY).closest("label").classList.toggle("hidden", shouldShow);

            const advancedBtn = this.deps.getElementById(DOM_IDS.TOGGLE_ADVANCED_SETTINGS);
            if (advancedBtn) {
                advancedBtn.classList.toggle("hidden", shouldShow);
            }

            if (shouldShow && list.children.length === 0) {
                createDateInput(true);
            }

            if (!shouldShow) {
                this.deps.getElementById(DOM_IDS.SPECIFIC_DATE_SPECIFIC_TIME).checked = false;
                this.deps.getElementById(DOM_IDS.SPECIFIC_DATE_TIME_CONTAINER).classList.add("hidden");

                const freqSelect = this.deps.getElementById(DOM_IDS.RECUR_FREQUENCY);
                if (freqSelect) {
                    const event = new Event("change");
                    freqSelect.dispatchEvent(event);
                }
            }

            this.updateRecurCountVisibility();
            this.updateRecurringSummary();
        });

        this.deps.safeAddEventListener(addBtn, "click", () => {
            createDateInput(false);
        });

        this.updateRecurringSummary();
    }

    /**
     * Get tomorrow's date
     */
    getTomorrow() {
        return _getTomorrow();
    }

    /**
     * Update recurring count visibility based on settings
     */
    updateRecurCountVisibility() {
        _updateRecurCountVisibility(this.deps);
    }

    // Fix #48: Removed duplicate updateRecurringSettingsVisibility() definition
    // The complete implementation is defined later in the class (with error handling)

    /**
     * Setup Apply and Cancel button handlers
     */
    setupApplyCancelButtons() {
        const applyBtn = this.deps.getElementById(DOM_IDS.APPLY_RECURRING_SETTINGS);
        const cancelBtn = this.deps.getElementById(DOM_IDS.CANCEL_RECURRING_SETTINGS);

        if (applyBtn) {
            this.deps.safeAddEventListener(applyBtn, "click", () => this.handleApplySettings());
        }

        if (cancelBtn) {
            this.deps.safeAddEventListener(cancelBtn, "click", () => this.handleCancelSettings());
        }
    }

    /**
     * Handle applying recurring settings to checked tasks
     * Delegates to recurringSettingsApplicator module for the heavy lifting
     */
    async handleApplySettings() {
        // Use the injected applyRecurringSettings function (from recurringSettingsApplicator.js)
        // Falls back to fallbackApplySettings if not wired
        return this.deps.applyRecurringSettings(
            this,  // Pass panel instance for callbacks
            () => this.buildRecurringSettingsFromPanel()  // Settings builder callback
        );
    }

    /**
     * Handle canceling recurring settings changes
     */
    handleCancelSettings() {
        const settingsPanel = this.deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
        settingsPanel?.classList.add("hidden");

        // Deselect all selected tasks
        this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
            el.classList.remove("selected");
            const checkbox = el.querySelector("input[type='checkbox']");
            if (checkbox) checkbox.checked = false;
        });

        // Hide checkboxes and uncheck them
        this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK).forEach(cb => {
            cb.checked = false;
            cb.classList.add("hidden");
            cb.closest(".recurring-task-item")?.classList.remove("checked");
        });

        // Hide the summary preview if visible
        const preview = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
        if (preview) preview.classList.add("hidden");

        this.updateRecurringSettingsVisibility();
    }

    /**
     * Setup biweekly day toggle
     */
    setupBiweeklyDayToggle() {
        this.deps.querySelectorAll(DOM_SELECTORS.BIWEEKLY_DAY_BOX).forEach(box => {
            this.deps.safeAddEventListener(box, "click", () => {
                box.classList.toggle("selected");
            });
        });
    }

    /**
     * Setup duration options (indefinitely checkbox, count/until radio buttons)
     */
    setupDurationRadioButtons() {
        const indefinitelyCheckbox = this.deps.getElementById(DOM_IDS.RECUR_INDEFINITELY);
        const limitedContainer = this.deps.getElementById(DOM_IDS.RECUR_LIMITED_CONTAINER);
        const countRadio = this.deps.getElementById(DOM_IDS.RECUR_COUNT_RADIO);
        const untilRadio = this.deps.getElementById(DOM_IDS.RECUR_UNTIL_RADIO);
        const countContainer = this.deps.getElementById(DOM_IDS.RECUR_COUNT_CONTAINER);
        const untilContainer = this.deps.getElementById(DOM_IDS.RECUR_UNTIL_CONTAINER);

        if (!indefinitelyCheckbox || !limitedContainer) return;

        // Handle indefinitely checkbox
        const updateLimitedVisibility = () => {
            if (indefinitelyCheckbox.checked) {
                limitedContainer.classList.add("hidden");
            } else {
                limitedContainer.classList.remove("hidden");
                // Trigger radio button update
                updateDurationContainers();
            }
        };

        // Handle radio buttons within limited container
        const updateDurationContainers = () => {
            if (countRadio && countContainer) {
                countContainer.classList.toggle("hidden", !countRadio.checked);
            }
            if (untilRadio && untilContainer) {
                untilContainer.classList.toggle("hidden", !untilRadio.checked);
            }
        };

        this.deps.safeAddEventListener(indefinitelyCheckbox, "change", updateLimitedVisibility);
        if (countRadio) this.deps.safeAddEventListener(countRadio, "change", updateDurationContainers);
        if (untilRadio) this.deps.safeAddEventListener(untilRadio, "change", updateDurationContainers);

        // Initialize visibility on load
        updateLimitedVisibility();
    }

    /**
     * Setup mutual exclusivity for monthly specific days vs week-of-month pattern
     * Delegates to recurringPanelSetup module
     */
    setupMonthlyMutualExclusion() {
        _setupMonthlyMutualExclusion(this.deps);
    }

    /**
     * Setup additional event listeners for recurring panel
     * Delegates to recurringPanelSetup module
     */
    setupAdditionalListeners() {
        _setupAdditionalListeners(this.deps, {
            updateRecurringSummary: () => this.updateRecurringSummary(),
            updateRecurCountVisibility: () => this.updateRecurCountVisibility()
        });
    }

    // ============================================
    // PANEL OPEN/CLOSE
    // ============================================

    /**
     * Open the recurring panel
     */
    async openPanel() {
        console.log('🔁 Opening recurring panel...');

        try {
            // ✅ Wait for core systems to be ready (AppState + data)
            await this.deps.appInit?.waitForCore();

            // Update panel with current data
            await this.updateRecurringPanel();

            // Show overlay
            const overlay = this.deps.getModal('recurringOverlay');
            if (overlay) {
                overlay._previousFocus = document.activeElement;
                if (!overlay.open) overlay.showModal();
            }

            // Hide settings panel initially
            const settingsPanel = this.deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
            if (settingsPanel) {
                settingsPanel.classList.add("hidden");
            }

            this.updateRecurringSettingsVisibility();

            this.state.panelOpen = true;
            console.log('✅ Recurring panel opened successfully');

        } catch (error) {
            console.error('❌ Error opening recurring panel:', error);
            this.deps.showNotification(getLabel('notify.panelOpenFailed'), 'error');
        }
    }

    /**
     * Close the recurring panel
     */
    closePanel() {
        console.log('🔁 Closing recurring panel...');

        try {
            const overlay = this.deps.getModal('recurringOverlay');
            if (overlay) {
                overlay.close();
                overlay._previousFocus?.focus();
            }

            // ✅ Hide the preview when panel closes
            const summaryContainer = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
            if (summaryContainer) {
                summaryContainer.classList.add("hidden");
            }

            this.updateRecurringSettingsVisibility();

            this.state.panelOpen = false;
            this.state.selectedTaskId = null;
            console.log('✅ Recurring panel closed');

        } catch (error) {
            console.error('❌ Error closing recurring panel:', error);
        }
    }

    // ============================================
    // PANEL RENDERING
    // ============================================

    /**
     * Update the recurring panel with current tasks
     * @param {Object} currentCycleData - Optional cycle data override
     */
    async updateRecurringPanel(currentCycleData = null) {
        console.log('🔄 Updating recurring panel...');

        try {
            const recurringList = this.deps.getElementById(DOM_IDS.RECURRING_TASK_LIST);
            if (!recurringList) {
                console.warn('⚠️ Recurring task list element not found');
                return;
            }

            // ✅ Wait for core systems to be ready (AppState + data)
            await this.deps.appInit?.waitForCore();

            const state = this.deps.AppState.get();
            const activeCycleId = state.appState?.activeCycleId;

            if (!activeCycleId) {
                console.warn('⚠️ No active cycle ID found for recurring panel');
                return;
            }

            const cycles = state.data?.cycles || {};
            let cycleData = currentCycleData || cycles[activeCycleId];

            if (!cycleData) {
                console.warn('⚠️ No cycle data found for recurring panel');
                return;
            }

            console.log('📊 Processing recurring templates:', Object.keys(cycleData.recurringTemplates || {}).length);
            console.log('🔍 Template IDs found:', Object.keys(cycleData.recurringTemplates || {}));

            // Use templates directly - they are the source of truth, independent of tasks array
            const recurringTasks = Object.values(cycleData.recurringTemplates || {});
            console.log('📋 Recurring templates:', recurringTasks.map(t => ({ id: t.id, text: t.text })));

            // Clear existing list
            recurringList.innerHTML = "";

            
            // Remember previously selected task AND checked tasks
            const previouslySelectedId = this.state.selectedTaskId;
            const previouslyCheckedIds = Array.from(
                this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM_CHECKED)
            ).map(el => el.dataset.taskId);

            // Clear previous selections
            this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
                el.classList.remove("selected");
            });

            // Handle empty state
            const emptyState = this.deps.getElementById(DOM_IDS.RECURRING_EMPTY_STATE);

            if (recurringTasks.length === 0) {
                console.log('📋 No recurring tasks found, showing empty state');
                if (emptyState) emptyState.classList.remove("hidden");

                // ✅ Hide the preview when no tasks
                const summaryContainer = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
                if (summaryContainer) {
                    summaryContainer.classList.add("hidden");
                }
            } else {
                if (emptyState) emptyState.classList.add("hidden");

                // Render each recurring task
                recurringTasks.forEach(task => {
                    if (!task || !task.id || !task.text) {
                        console.warn("⚠ Skipping malformed recurring task in panel:", task);
                        return;
                    }

                    const item = this.createRecurringTaskItem(task, cycleData);
                    recurringList.appendChild(item);

                    // ✅ Restore selection if this was the previously selected task
                    if (previouslySelectedId && task.id === previouslySelectedId) {
                        item.classList.add("selected");
                        this.showTaskSummaryPreview(task);
                    }

                    // ✅ Restore checked state if this task was previously checked
                    if (previouslyCheckedIds.includes(task.id)) {
                        item.classList.add("checked");
                        const checkbox = item.querySelector(DOM_SELECTORS.RECURRING_CHECK);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    }
                });
            }

            this.updateRecurringSummary();
            console.log('✅ Recurring panel updated successfully');

        } catch (error) {
            console.error('❌ Error updating recurring panel:', error);
            this.deps.showNotification(getLabel('notify.panelUpdateFailed'), 'warning');
        }
    }

    /**
     * Create a recurring task list item
     * @param {Object} task - The task object
     * @param {Object} cycleData - Current cycle data
     * @returns {HTMLElement} The task item element
     */
    createRecurringTaskItem(task, cycleData) {
        const item = document.createElement("li");
        item.className = "recurring-task-item";
        item.setAttribute("data-task-id", task.id);

        // ✅ XSS PROTECTION: Use DOM APIs with textContent (safer than innerHTML + escapeHtml)
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "recurring-check hidden";
        checkbox.id = `recurring-check-${task.id}`;
        checkbox.name = `recurring-check-${task.id}`;
        checkbox.setAttribute("aria-label", getLabel('recurring.markTaskTemporarily'));

        const textSpan = document.createElement("span");
        textSpan.className = "recurring-task-text";
        textSpan.textContent = task.text;  // textContent auto-escapes HTML

        const removeBtn = document.createElement("button");
        removeBtn.title = getLabel('recurring.removeFromRecurring');
        removeBtn.className = "recurring-remove-btn";
        removeBtn.innerHTML = `<span class="icon recurring-trash-icon" aria-hidden="true">${ICONS['trash']}</span>`;

        item.appendChild(checkbox);
        item.appendChild(textSpan);
        item.appendChild(removeBtn);

        // ✅ MEMORY LEAK FIX: No listeners added - handled by recurringPanelEvents.js delegation

        return item;
    }

    /**
     * Handle remove task from recurring
     * @param {Object} task - The task to remove
     * @param {HTMLElement} item - The list item element
     */
    handleRemoveTask(task, item) {
        this.deps.showConfirmationModal({
            title: getLabel('modal.removeRecurringTitle'),
            message: getLabel('modal.removeRecurringMessage', { vars: { name: task.text } }),
            confirmText: getLabel('modal.removeRecurringConfirm'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: async (confirmed) => {
                if (!confirmed) return;

                try {
                    // ✅ Use AppState instead of direct localStorage manipulation
                    if (!this.deps.AppState?.isReady?.()) {
                        console.error('❌ AppState not ready for task removal');
                        this.deps.showNotification(getLabel('notify.appNotReady'), 'error');
                        return;
                    }

                    const state = this.deps.AppState.get();
                    const activeCycleId = state.appState?.activeCycleId;

                    if (!activeCycleId) {
                        console.error('❌ No active cycle found for task removal');
                        this.deps.showNotification(getLabel('notify.recurringNoActiveCycle'), 'error');
                        return;
                    }

                    // Compute current mode for deleteWhenComplete reset
                    const currentCycle = state.data?.cycles?.[activeCycleId];
                    const isToDoMode = currentCycle?.deleteCheckedTasks === true;
                    const currentMode = isToDoMode ? 'todo' : 'cycle';

                    // ✅ Update via shared deactivation helper (immediate save)
                    await this.deps.updateAppState(draft => {
                        const cycle = draft.data.cycles[activeCycleId];
                        this.deps.deactivateTaskRecurringState(cycle, task.id, currentMode);
                    }, true); // ✅ Immediate save when removing recurring from panel

                    this.deps.showNotification(`↩️ ${getLabel('notify.recurringTurnedOff')}`, "info", 5000);

                    // Remove recurring visual state
                    const matchingTaskItem = this.deps.querySelector(DATA_SELECTORS.taskById(task.id));
                    if (matchingTaskItem) {
                        // Remove active state from recurring button
                        const recurringBtn = matchingTaskItem.querySelector(DOM_SELECTORS.RECURRING_BTN);
                        if (recurringBtn) {
                            recurringBtn.classList.remove("active");
                            recurringBtn.setAttribute("aria-pressed", "false");
                            recurringBtn.disabled = false;
                        }
                        // Remove the recurring indicator icon from task label
                        const recurringIndicator = matchingTaskItem.querySelector(DOM_SELECTORS.RECURRING_INDICATOR);
                        if (recurringIndicator) {
                            recurringIndicator.remove();
                        }
                        matchingTaskItem.classList.remove("recurring");
                        matchingTaskItem.removeAttribute("data-recurring-settings");

                        // Restore delete-when-complete state based on cycle mode
                        const updatedState = this.deps.AppState.get();
                        const freshCycle = updatedState.data?.cycles?.[activeCycleId];
                        const isToDoMode = freshCycle?.deleteCheckedTasks === true;
                        const defaultDeleteState = isToDoMode; // todo=true, cycle=false

                        // Update delete-when-complete button
                        const deleteBtn = matchingTaskItem.querySelector(DOM_SELECTORS.DELETE_WHEN_COMPLETE_BTN);
                        if (deleteBtn) {
                            deleteBtn.classList.toggle('active', defaultDeleteState);
                            deleteBtn.classList.toggle('delete-when-complete-active', defaultDeleteState);
                            deleteBtn.setAttribute('aria-pressed', defaultDeleteState.toString());
                        }

                        // Update data attribute and visual indicators
                        matchingTaskItem.dataset.deleteWhenComplete = defaultDeleteState.toString();
                        if (isToDoMode) {
                            matchingTaskItem.classList.remove('show-delete-indicator');
                            matchingTaskItem.classList.toggle('kept-task', !defaultDeleteState);
                        } else {
                            matchingTaskItem.classList.toggle('show-delete-indicator', defaultDeleteState);
                            matchingTaskItem.classList.remove('kept-task');
                        }
                    }

                    item.remove();
                    this.updateRecurringPanelButtonVisibility();

                    // ✅ Check remaining templates via AppState
                    const updatedState = this.deps.AppState.get();
                    const updatedCycle = updatedState.data?.cycles?.[activeCycleId];
                    const remaining = Object.values(updatedCycle?.recurringTemplates || {});
                    if (remaining.length === 0) {
                        const overlay = this.deps.getModal('recurringOverlay');
                        if (overlay) {
                            overlay.close();
                            overlay._previousFocus?.focus();
                        }
                    }

                    // Undo/redo buttons are updated automatically via the undo system
                    // when AppState changes (captureStateSnapshot is called)

                } catch (error) {
                    console.error('❌ Error removing recurring task:', error);
                    this.deps.showNotification(getLabel('notify.recurringRemoveFailed'), 'error');
                }
            }
        });
    }

    // ============================================
    // SETTINGS VISIBILITY
    // ============================================

    /**
     * Update recurring settings panel visibility
     */
    updateRecurringSettingsVisibility() {
        try {
            const anySelected = this.deps.querySelector(DOM_SELECTORS.RECURRING_TASK_ITEM_SELECTED);
            const settingsPanel = this.deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
            const checkboxes = this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK);
            const changeBtns = this.deps.querySelectorAll(DOM_SELECTORS.CHANGE_RECURRING_BTN);
            const toggleContainer = this.deps.getElementById(DOM_IDS.RECURRING_TOGGLE_ACTIONS);
            const toggleBtn = this.deps.getElementById(DOM_IDS.TOGGLE_CHECK_ALL);
            const taskCount = this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).length;

            const show = !!anySelected;

            if (settingsPanel) {
                settingsPanel.classList.toggle("hidden", !show);

                // Show or hide checkboxes
                checkboxes.forEach(box => {
                    box.classList.toggle("hidden", !show);
                });

                // Hide change buttons when panel is open
                changeBtns.forEach(btn => {
                    btn.classList.toggle("hidden", show);
                });
            }

            // Only show toggle if panel is open AND checkboxes are visible AND more than one task
            const checkboxesVisible = Array.from(checkboxes).some(cb => !cb.classList.contains("hidden"));
            const shouldShowToggle = show && taskCount > 1 && checkboxesVisible;

            if (toggleContainer) {
                toggleContainer.classList.toggle("hidden", !shouldShowToggle);
            }

            // Update button label
            if (toggleBtn && shouldShowToggle) {
                const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked && !cb.classList.contains("hidden"));
                toggleBtn.textContent = anyUnchecked ? getLabel('recurring.checkAll') : getLabel('recurring.uncheckAll');
            }

            this.updateRecurringSummary();

        } catch (error) {
            console.error('❌ Error updating settings visibility:', error);
        }
    }

    // ============================================
    // TASK SUMMARY PREVIEW
    // ============================================

    /**
     * Show task summary preview in panel
     * @param {Object} task - The task to preview
     */
    showTaskSummaryPreview(task) {
        console.log('👁️ Showing task summary preview...', task?.id);

        try {
            if (!task || !task.id) {
                console.warn("⚠️ No valid task provided for recurring preview.");
                return;
            }

            let summaryContainer = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
            if (!summaryContainer) {
                summaryContainer = this.createTaskSummaryPreview();
            }

            // ✅ Remove hidden class to show the preview
            summaryContainer.classList.remove("hidden");

            // Get recurring settings
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for showTaskSummaryPreview');
                return;
            }

            const state = this.deps.AppState.get();
            const activeCycleId = state.appState?.activeCycleId;

            if (!activeCycleId) {
                console.warn('⚠️ No active cycle ID found for task preview');
                return;
            }

            const currentCycle = state.data?.cycles?.[activeCycleId];
            if (!currentCycle) {
                console.warn('⚠️ No active cycle found for task preview');
                return;
            }

            const recurringSettings = task.recurringSettings ||
                currentCycle?.recurringTemplates?.[task.id]?.recurringSettings;

            // ✅ Get the template to access nextScheduledOccurrence
            const template = currentCycle?.recurringTemplates?.[task.id];

            // ✅ Update the preview text element instead of replacing entire innerHTML
            const previewText = this.deps.getElementById(DOM_IDS.RECURRING_PREVIEW_TEXT);
            if (!previewText) {
                console.warn('⚠️ recurring-preview-text element not found');
                return;
            }

            // ✅ XSS PROTECTION: Use DOM APIs with textContent (safer than innerHTML + escapeHtml)
            previewText.innerHTML = '';  // Clear existing content

            const taskNameStrong = document.createElement('strong');
            taskNameStrong.textContent = task.text;  // textContent auto-escapes HTML
            previewText.appendChild(taskNameStrong);
            previewText.appendChild(document.createElement('br'));

            if (!recurringSettings) {
                const noSettingsEm = document.createElement('em');
                noSettingsEm.textContent = getLabel('empty.noRecurringSettings');
                previewText.appendChild(noSettingsEm);
                return;
            }

            const summaryText = this.deps.buildRecurringSummary(recurringSettings);
            const summarySpan = document.createElement('span');
            summarySpan.className = 'recurring-summary-text';
            summarySpan.textContent = summaryText;
            previewText.appendChild(summarySpan);

            // ✅ Get next occurrence text
            const nextOccurrenceText = template?.nextScheduledOccurrence
                ? this.deps.formatNextOccurrence(template.nextScheduledOccurrence)
                : null;

            if (nextOccurrenceText) {
                previewText.appendChild(document.createElement('br'));
                const nextSpan = document.createElement('span');
                nextSpan.className = 'next-occurrence-text';
                nextSpan.textContent = nextOccurrenceText;
                previewText.appendChild(nextSpan);
            }

            // ✅ Only show button if settings panel is NOT currently open
            const changeBtn = this.deps.getElementById(DOM_IDS.CHANGE_RECURRING_SETTINGS);
            const settingsPanel = this.deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
            const isEditingSettings = settingsPanel && !settingsPanel.classList.contains("hidden");

            if (changeBtn) {
                if (isEditingSettings) {
                    // Keep button hidden while editing
                    changeBtn.classList.add("hidden");
                } else {
                    // Show button when not editing
                    changeBtn.style.display = ""; // Remove any display: none
                    changeBtn.classList.remove("hidden"); // Remove hidden class if present
                }
            } else {
                console.warn('⚠️ Change recurring settings button not found in DOM');
            }

        } catch (error) {
            console.error('❌ Error showing task summary:', error);
        }
    }

    /**
     * Create task summary preview container
     * @returns {HTMLElement} The preview container
     */
    createTaskSummaryPreview() {
        const container = document.createElement('div');
        container.id = 'recurring-summary-preview';
        container.className = 'recurring-summary-preview hidden';

        // Create inner structure
        const summaryBox = document.createElement('div');
        summaryBox.className = 'summary-box';

        const previewText = document.createElement('p');
        previewText.id = 'recurring-preview-text';

        const changeBtn = document.createElement('button');
        changeBtn.id = 'change-recurring-settings';
        changeBtn.className = 'change-recurring-btn';
        changeBtn.textContent = getLabel('recurring.changeSettings');

        // Attach click listener to button (guard for tests)
        if (this.deps.safeAddEventListener) {
            this.deps.safeAddEventListener(changeBtn, 'click', () => {
                console.log('🔧 Change recurring settings clicked');
                if (this.state.selectedTaskId) {
                    this.openRecurringSettingsPanelForTask(this.state.selectedTaskId);
                } else {
                    console.warn('⚠️ No task selected for changing settings');
                }
            });
        }

        summaryBox.appendChild(previewText);
        summaryBox.appendChild(changeBtn);
        container.appendChild(summaryBox);

        const panel = this.deps.getModal('recurringPanel');
        if (panel) {
            panel.appendChild(container);
        }

        return container;
    }

    // ============================================
    // SUMMARY TEXT GENERATION
    // ============================================

    /**
     * Update recurring summary text
     */
    updateRecurringSummary() {
        console.log('📝 Updating recurring summary...');

        try {
            const summaryEl = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY);
            if (!summaryEl) {
                console.warn('⚠️ Recurring summary element not found');
                return;
            }

            // Build settings from the panel input
            const settings = this.buildRecurringSettingsFromPanel();

            console.log('📊 Built settings from panel:', settings);

            // Simulate fallback default time (for preview only)
            if (!settings.useSpecificTime && !settings.defaultRecurTime) {
                settings.defaultRecurTime = new Date().toISOString();
            }

            // Generate summary text using the shared utility
            const summaryText = this.deps.buildRecurringSummary(settings);

            console.log('📄 Generated summary text:', summaryText);

            // Apply to DOM
            summaryEl.textContent = summaryText;
            summaryEl.classList.remove("hidden");

            console.log('✅ Recurring summary updated successfully');

        } catch (error) {
            console.error('❌ Error updating recurring summary:', error);
        }
    }

    /**
     * Build recurring settings object from panel inputs
     * @returns {Object} Settings object
     */
    buildRecurringSettingsFromPanel() {
        return _buildRecurringSettingsFromPanelForm(this.deps, this.state);
    }

    // ============================================
    // FORM POPULATION
    // ============================================

    /**
     * Populate recurring form with settings
     * @param {Object} settings - Recurring settings to populate
     */
    populateRecurringFormWithSettings(settings) {
        _populateRecurringFormWithSettings(this.deps, settings);
    }

    /**
     * Clear/reset the recurring form
     */
    clearRecurringForm() {
        _clearRecurringForm(this.deps);
    }

    // ============================================
    // BUTTON VISIBILITY
    // ============================================

    /**
     * Update recurring panel button visibility
     * Button is now always visible (no longer hidden when no recurring tasks)
     */
    updateRecurringPanelButtonVisibility() {
        try {
            const panelButton = this.deps.getElementById(DOM_IDS.OPEN_RECURRING_PANEL);
            if (!panelButton) {
                console.warn('⚠️ Recurring panel button not found in DOM');
                return;
            }

            // Always show the recurring button - users can now add tasks from the panel
            panelButton.classList.remove("hidden");
            console.log('🔘 Recurring button always visible');

        } catch (error) {
            console.error('❌ Error updating panel button visibility:', error);
        }
    }

    // ============================================
    // ADD TASK SECTION
    // ============================================

    /**
     * Setup the "Add Task" button and available tasks list
     */
    setupAddTaskSection() {
        const addTaskBtn = this.deps.getElementById(DOM_IDS.ADD_RECURRING_TASK_BTN);
        const availableTasksList = this.deps.getElementById(DOM_IDS.AVAILABLE_TASKS_LIST);
        const confirmBtn = this.deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);

        if (!addTaskBtn || !availableTasksList) {
            console.warn('⚠️ Add task section elements not found');
            return;
        }

        // Toggle available tasks list visibility
        this.deps.safeAddEventListener(addTaskBtn, "click", () => {
            const isHidden = availableTasksList.classList.contains("hidden");

            if (isHidden) {
                // Populate and show the list
                this.populateAvailableTasks();
                availableTasksList.classList.remove("hidden");
                addTaskBtn.innerHTML = `<i class="fas fa-times"></i> ${getLabel('button.cancel')}`;
            } else {
                // Hide the list and reset
                availableTasksList.classList.add("hidden");
                addTaskBtn.textContent = getLabel('recurring.addToRecurring');
                if (confirmBtn) confirmBtn.classList.add("hidden");
            }
        });

        // Setup delegation for checkbox changes
        const nonRecurringList = this.deps.getElementById(DOM_IDS.NON_RECURRING_TASKS);
        if (nonRecurringList) {
            this.deps.safeAddEventListener(nonRecurringList, "change", (e) => {
                if (e.target.type === "checkbox") {
                    const taskItem = e.target.closest("li[data-task-id]");
                    if (taskItem) {
                        taskItem.classList.toggle("selected", e.target.checked);
                    }
                    this.updateConfirmButtonVisibility();
                }
            });

            // Also allow clicking the row to toggle
            this.deps.safeAddEventListener(nonRecurringList, "click", (e) => {
                // Don't toggle if clicking directly on checkbox
                if (e.target.type === "checkbox") return;

                const taskItem = e.target.closest("li[data-task-id]");
                if (!taskItem) return;

                const checkbox = taskItem.querySelector("input[type='checkbox']");
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    taskItem.classList.toggle("selected", checkbox.checked);
                    this.updateConfirmButtonVisibility();
                }
            });
        }

        // Setup confirm button
        if (confirmBtn) {
            this.deps.safeAddEventListener(confirmBtn, "click", () => {
                this.handleConfirmAddRecurring();
            });
        }

        console.log('✅ Add task section setup complete');
    }

    /**
     * Update confirm button visibility based on selection
     */
    updateConfirmButtonVisibility() {
        const confirmBtn = this.deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);
        const selectedCount = this.deps.querySelectorAll(DOM_SELECTORS.NON_RECURRING_SELECTED).length;

        if (confirmBtn) {
            if (selectedCount > 0) {
                confirmBtn.classList.remove("hidden");
                confirmBtn.textContent = selectedCount === 1
                    ? getLabel('recurring.addToRecurringShort')
                    : getLabel('recurring.addTasksToRecurring', { vars: { count: selectedCount } });
            } else {
                confirmBtn.classList.add("hidden");
            }
        }
    }

    /**
     * Populate the available (non-recurring) tasks list
     */
    populateAvailableTasks() {
        const nonRecurringList = this.deps.getElementById(DOM_IDS.NON_RECURRING_TASKS);
        const noTasksMessage = this.deps.getElementById(DOM_IDS.NO_AVAILABLE_TASKS);
        const confirmBtn = this.deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);

        if (!nonRecurringList || !noTasksMessage) {
            console.warn('⚠️ Available tasks list elements not found');
            return;
        }

        // Clear existing list and hide confirm button
        nonRecurringList.innerHTML = "";
        if (confirmBtn) confirmBtn.classList.add("hidden");

        try {
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for populating available tasks');
                noTasksMessage.classList.remove("hidden");
                noTasksMessage.textContent = getLabel('notify.taskLoadFailed');
                return;
            }

            const state = this.deps.AppState.get();
            const activeCycleId = state.appState?.activeCycleId;
            const currentCycle = state.data?.cycles?.[activeCycleId];

            if (!currentCycle) {
                console.warn('⚠️ No active cycle found');
                noTasksMessage.classList.remove("hidden");
                noTasksMessage.textContent = getLabel('notify.noRoutineLoaded');
                return;
            }

            const allTasks = currentCycle.tasks || [];
            const recurringTemplateIds = Object.keys(currentCycle.recurringTemplates || {});

            // Filter to non-recurring tasks only
            const nonRecurringTasks = allTasks.filter(task =>
                task && task.id && task.text && !recurringTemplateIds.includes(task.id)
            );

            if (nonRecurringTasks.length === 0) {
                // Check if there are no tasks at all vs all are recurring
                if (allTasks.length === 0) {
                    noTasksMessage.textContent = getLabel('empty.noRoutineTasks');
                } else {
                    noTasksMessage.textContent = getLabel('notify.allTasksRecurring');
                }
                noTasksMessage.classList.remove("hidden");
                return;
            }

            // Hide "no tasks" message
            noTasksMessage.classList.add("hidden");

            // Render non-recurring tasks with checkboxes
            nonRecurringTasks.forEach(task => {
                const li = document.createElement("li");
                li.dataset.taskId = task.id;

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = `add-recurring-${task.id}`;
                checkbox.setAttribute("aria-label", getLabel('recurring.selectTask', { vars: { name: task.text } }));

                const textSpan = document.createElement("span");
                textSpan.className = "task-text";
                textSpan.textContent = task.text;

                li.appendChild(checkbox);
                li.appendChild(textSpan);
                nonRecurringList.appendChild(li);
            });

            console.log(`📋 Populated ${nonRecurringTasks.length} available tasks`);

        } catch (error) {
            console.error('❌ Error populating available tasks:', error);
            noTasksMessage.classList.remove("hidden");
            noTasksMessage.textContent = getLabel('notify.taskLoadError');
        }
    }

    /**
     * Handle confirming add selected tasks as recurring
     * Adds all selected tasks with default recurring settings
     */
    async handleConfirmAddRecurring() {
        console.log('➕ Confirming add tasks as recurring...');

        try {
            if (!this.deps.AppState?.isReady?.()) {
                console.error('❌ AppState not ready');
                this.deps.showNotification(getLabel('notify.appNotReady'), 'error');
                return;
            }

            // Get selected task IDs
            const selectedItems = this.deps.querySelectorAll(DOM_SELECTORS.NON_RECURRING_SELECTED);
            const selectedTaskIds = Array.from(selectedItems).map(li => li.dataset.taskId);

            if (selectedTaskIds.length === 0) {
                this.deps.showNotification(getLabel('notify.recurringNoTasksSelected'), 'warning');
                return;
            }

            const state = this.deps.AppState.get();
            const activeCycleId = state.appState?.activeCycleId;

            if (!activeCycleId) {
                console.error('❌ No active cycle');
                this.deps.showNotification(getLabel('notify.recurringNoActiveCycle'), 'error');
                return;
            }

            // Default recurring settings
            const defaultSettings = this.deps.normalizeRecurringSettings({
                frequency: 'daily',
                recurIndefinitely: true
            });

            // Add each selected task to recurring templates via shared helper
            await this.deps.updateAppState(draft => {
                const cycle = draft.data.cycles[activeCycleId];

                selectedTaskIds.forEach(taskId => {
                    const task = cycle.tasks.find(t => t.id === taskId);
                    if (task) {
                        this.deps.activateTaskRecurringState(
                            cycle, taskId, defaultSettings, this.deps.calculateNextOccurrence
                        );
                    }
                });
            }, true); // Immediate save

            // Hide the available tasks list
            const availableTasksList = this.deps.getElementById(DOM_IDS.AVAILABLE_TASKS_LIST);
            const addTaskBtn = this.deps.getElementById(DOM_IDS.ADD_RECURRING_TASK_BTN);
            const confirmBtn = this.deps.getElementById(DOM_IDS.CONFIRM_ADD_RECURRING);

            if (availableTasksList) availableTasksList.classList.add("hidden");
            if (addTaskBtn) addTaskBtn.textContent = getLabel('recurring.addToRecurring');
            if (confirmBtn) confirmBtn.classList.add("hidden");

            // Refresh the panel to show new recurring tasks
            this.updateRecurringPanel();

            // Refresh main task list from state
            setTimeout(() => {
                this.deps.refreshUIFromState?.();
            }, 0);

            const taskWord = selectedTaskIds.length === 1 ? 'task' : 'tasks';
            this.deps.showNotification(`🔁 ${getLabel('notify.recurringAdded', { vars: { count: selectedTaskIds.length, taskWord } })}`, 'success');

            console.log(`✅ Added ${selectedTaskIds.length} tasks as recurring`);

        } catch (error) {
            console.error('❌ Error adding tasks as recurring:', error);
            this.deps.showNotification(getLabel('notify.recurringAddFailed'), 'error');
        }
    }

    // ============================================
    // ALWAYS SHOW RECURRING SETTING
    // ============================================

    /**
     * Save always show recurring setting to AppState
     */
    async saveAlwaysShowRecurringSetting() {
        console.log('💾 Saving always show recurring setting...');

        try {
            const checkbox = this.deps.getElementById(DOM_IDS.ALWAYS_SHOW_RECURRING);
            if (!checkbox) {
                console.warn('⚠️ Always show recurring checkbox not found');
                return;
            }

            const alwaysShow = checkbox.checked;

            // ✅ Save via AppState
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for saving always show recurring setting');
                return;
            }

            await this.deps.updateAppState(draft => {
                if (!draft.settings) {
                    draft.settings = {};
                }
                draft.settings.alwaysShowRecurring = alwaysShow;
            }, true); // ✅ Immediate save for always-show-recurring setting

            console.log('✅ Always show recurring setting saved via AppState:', alwaysShow);

            // ✅ Trigger button refresh to show/hide recurring buttons after small delay (DI-pure)
            // This ensures AppState changes have fully propagated
            setTimeout(() => {
                if (typeof this.deps.refreshTaskButtonsForModeChange === 'function') {
                    console.log('🔄 Refreshing task buttons for always-show-recurring change...');
                    this.deps.refreshTaskButtonsForModeChange();
                }
            }, 50);

        } catch (error) {
            console.error('❌ Error saving always show recurring setting:', error);
        }
    }

    /**
     * Load always show recurring setting from AppState
     */
    loadAlwaysShowRecurringSetting() {
        console.log('📥 Loading always show recurring setting...');

        try {
            if (!this.deps.AppState?.isReady?.()) {
                console.warn('⚠️ AppState not ready for loading always show recurring setting');
                return;
            }

            const state = this.deps.AppState.get();
            const isEnabled = state.settings?.alwaysShowRecurring || false;

            console.log('📊 Loaded always show recurring setting from AppState:', isEnabled);

            const checkbox = this.deps.getElementById(DOM_IDS.ALWAYS_SHOW_RECURRING);
            if (checkbox) {
                checkbox.checked = isEnabled;
            }

        } catch (error) {
            console.error('❌ Error loading always show recurring setting:', error);
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    /**
     * Attach recurring summary listeners
     */
    attachRecurringSummaryListeners() {
        if (!this.deps.safeAddEventListener) return; // Guard: dependency not injected (e.g., in tests)
        console.log('🔗 Attaching recurring summary listeners...');

        try {
            const panel = this.deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
            if (!panel) {
                console.warn('⚠️ Recurring settings panel not found');
                return;
            }

            // Listen for changes in the panel
            this.deps.safeAddEventListener(panel, "change", () => this.updateRecurringSummary());
            this.deps.safeAddEventListener(panel, "click", () => this.updateRecurringSummary());

            console.log('✅ Recurring summary listeners attached successfully');

        } catch (error) {
            console.error('❌ Error attaching summary listeners:', error);
        }
    }

    /**
     * Wire always-show-recurring checkbox listener
     * Moved from orchestrator.js for proper module ownership
     */
    wireAlwaysShowRecurringListener() {
        if (!this.deps.safeAddEventListener) return; // Guard: dependency not injected (e.g., in tests)
        const checkbox = this.deps.getElementById(DOM_IDS.ALWAYS_SHOW_RECURRING);
        if (!checkbox) {
            console.warn('⚠️ always-show-recurring checkbox not found');
            return;
        }

        this.deps.safeAddEventListener(checkbox, "change", () => {
            this.saveAlwaysShowRecurringSetting();
        });
        console.log('✅ always-show-recurring listener wired');
    }

    /**
     * Wire delegated click listener for .open-recurring-settings buttons
     * Moved from orchestrator.js for proper module ownership
     */
    wireRecurringSettingsClickListener() {
        if (!this.deps.safeAddEventListener) return; // Guard: dependency not injected (e.g., in tests)
        this.deps.safeAddEventListener(document, "click", (e) => {
            const target = e.target.closest(".open-recurring-settings");
            if (!target) return;

            const taskId = target.dataset.taskId;
            if (!taskId) return;

            this.openRecurringSettingsPanelForTask(taskId);
        });
        console.log('✅ Recurring settings click listener wired');
    }

    // ============================================
    // PUBLIC API METHODS
    // ============================================

    /**
     * Open recurring settings panel for a specific task
     * @param {string} taskIdToPreselect - Task ID to preselect
     */
    async openRecurringSettingsPanelForTask(taskIdToPreselect) {
        console.log('⚙️ Opening recurring settings panel for task:', taskIdToPreselect);

        try {
            await this.updateRecurringPanel(); // Render panel fresh

            // Find and preselect the correct task
            const itemToSelect = this.deps.querySelector(DATA_SELECTORS.recurringTaskById(taskIdToPreselect));
            if (itemToSelect) {
                itemToSelect.classList.add("selected");

                const checkbox = itemToSelect.querySelector("input[type='checkbox']");
                if (checkbox) {
                    checkbox.checked = true;
                    itemToSelect.classList.add("checked");
                }

                // Scroll the selected task into view within the list
                requestAnimationFrame(() => {
                    itemToSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });

                // Show task preview
                if (this.deps.AppState?.isReady?.()) {
                    const state = this.deps.AppState.get();
                    const activeCycleId = state.appState?.activeCycleId;
                    const task = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskIdToPreselect);

                    if (task) {
                        this.showTaskSummaryPreview(task);
                    }
                }
            }

            // Show panel
            const overlay = this.deps.getModal('recurringOverlay');
            if (overlay) {
                overlay._previousFocus = document.activeElement;
                if (!overlay.open) overlay.showModal();
            }

            // Make sure checkboxes and toggle show correctly
            this.updateRecurringSettingsVisibility();

            console.log('✅ Recurring settings panel opened successfully');

        } catch (error) {
            console.error('❌ Error opening settings panel:', error);
        }
    }
}

// ============================================
// STANDALONE UTILITY FUNCTIONS
// ============================================

// Loaded dynamically with version cache-busting
let _buildRecurringSummaryFromSettings = null;
let _generateMonthlyDayGrid = null;
let _generateYearlyMonthGrid = null;
let _generateYearlyDayGrid = null;
// Form module functions
let _formModule = null;
let _getTomorrow = null;
let _getSelectedMonthlyDays = null;
let _getSelectedYearlyMonthsForm = null;
let _updateRecurCountVisibility = null;
let _buildRecurringSettingsFromPanelForm = null;
let _populateRecurringFormWithSettings = null;
let _clearRecurringForm = null;
// Events module functions
let _eventsModule = null;
let _initEventDelegation = null;
// Setup module functions
let _setupModule = null;
let _setupFrequencySelector = null;
let _setupToggleVisibility = null;
let _setupToggleCheckAll = null;
let _setupAdvancedToggle = null;
let _setupTimeConversion = null;
let _setupMilitaryTimeToggle = null;
let _setupMonthlyMutualExclusion = null;
let _setupAdditionalListeners = null;

/**
 * Load sub-modules with version cache-busting
 * @param {string} version - Version string for cache-busting
 */
export async function loadPanelSubModules(version) {
    if (_buildRecurringSummaryFromSettings) {
        return; // Already loaded
    }

    console.log(`Loading recurringPanel sub-modules with v=${version}...`);

    const [summaryModule, gridsModule, formModule, eventsModule, setupModule] = await Promise.all([
        import(`./recurringPanelSummary.js?v=${version}`),
        import(`./recurringPanelGrids.js?v=${version}`),
        import(`./recurringPanelForm.js?v=${version}`),
        import(`./recurringPanelEvents.js?v=${version}`),
        import(`./recurringPanelSetup.js?v=${version}`)
    ]);

    _buildRecurringSummaryFromSettings = summaryModule.buildRecurringSummaryFromSettings;
    _generateMonthlyDayGrid = gridsModule.generateMonthlyDayGrid;
    _generateYearlyMonthGrid = gridsModule.generateYearlyMonthGrid;
    _generateYearlyDayGrid = gridsModule.generateYearlyDayGrid;

    // Form module
    _formModule = formModule;
    _getTomorrow = formModule.getTomorrow;
    _getSelectedMonthlyDays = formModule.getSelectedMonthlyDays;
    _getSelectedYearlyMonthsForm = formModule.getSelectedYearlyMonths;
    _updateRecurCountVisibility = formModule.updateRecurCountVisibility;
    _buildRecurringSettingsFromPanelForm = formModule.buildRecurringSettingsFromPanel;
    _populateRecurringFormWithSettings = formModule.populateRecurringFormWithSettings;
    _clearRecurringForm = formModule.clearRecurringForm;

    // Events module
    _eventsModule = eventsModule;
    _initEventDelegation = eventsModule.initEventDelegation;

    // Setup module
    _setupModule = setupModule;
    _setupFrequencySelector = setupModule.setupFrequencySelector;
    _setupToggleVisibility = setupModule.setupToggleVisibility;
    _setupToggleCheckAll = setupModule.setupToggleCheckAll;
    _setupAdvancedToggle = setupModule.setupAdvancedToggle;
    _setupTimeConversion = setupModule.setupTimeConversion;
    _setupMilitaryTimeToggle = setupModule.setupMilitaryTimeToggle;
    _setupMonthlyMutualExclusion = setupModule.setupMonthlyMutualExclusion;
    _setupAdditionalListeners = setupModule.setupAdditionalListeners;

    console.log('recurringPanel sub-modules loaded');
}

/**
 * Build recurring summary text from settings
 * Wrapper that calls the dynamically loaded function
 * @param {Object} settings - Recurring settings
 * @returns {string} Summary text
 */
export function buildRecurringSummaryFromSettings(settings = {}) {
    if (!_buildRecurringSummaryFromSettings) {
        console.warn('buildRecurringSummaryFromSettings called before sub-modules loaded, using inline fallback');
        // Minimal fallback
        return `Repeats ${settings.frequency || 'daily'}`;
    }
    return _buildRecurringSummaryFromSettings(settings);
}

// ============================================
// EXPORTS
// ============================================

// DI-pure module (no window.* fallbacks)
console.log('🛡️ RecurringPanel module loaded (DI-pure, no window.* exports)');
