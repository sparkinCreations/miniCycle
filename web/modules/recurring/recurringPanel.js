/**
 * miniCycle Recurring Tasks - UI Panel Manager
 *
 * Pattern: Resilient Constructor 🛡️
 * Purpose: UI management for recurring task panel with graceful degradation
 *
 * This module handles:
 * - Recurring task panel rendering
 * - Form population and validation
 * - Settings panel visibility management
 * - Summary text generation
 * - Button visibility management
 *
 * @module recurringPanel
 * @requires recurringCore (via dependency injection)
 * @requires AppInit (for initialization coordination)
 */

// ✅ appInit now injected via DI (no static import - enables versioning)
// ✅ REMOVED: Static import creates duplicate without version parameter
// import { formatNextOccurrence, calculateNextOccurrence } from './recurringCore.js';
// These will be passed as dependencies instead

// ============================================
// RECURRING PANEL MANAGER CLASS
// ============================================

/**
 * RecurringPanelManager - Manages the recurring tasks UI panel
 * Uses Resilient Constructor pattern for graceful degradation
 */
export class RecurringPanelManager {
    constructor(dependencies = {}) {
        console.log('🎛️ Initializing RecurringPanelManager...');

        // Store dependencies (DI-pure, no window.* fallbacks for state management)
        this.deps = {
            // AppInit for initialization coordination (injected, not imported)
            appInit: dependencies.appInit || null,

            // From recurringCore module
            applyRecurringSettings: dependencies.applyRecurringSettings || this.fallbackApplySettings.bind(this),
            deleteTemplate: dependencies.deleteTemplate || this.fallbackDeleteTemplate.bind(this),
            buildRecurringSummary: dependencies.buildRecurringSummary || this.fallbackBuildSummary.bind(this),
            normalizeRecurringSettings: dependencies.normalizeRecurringSettings || this.fallbackNormalize.bind(this),
            formatNextOccurrence: dependencies.formatNextOccurrence || this.fallbackFormatNext.bind(this),
            calculateNextOccurrence: dependencies.calculateNextOccurrence || this.fallbackCalculateNext.bind(this),

            // State management (DI-pure, must be injected)
            AppState: dependencies.AppState || null,
            updateAppState: dependencies.updateAppState || null,
            loadData: dependencies.loadData || null,

            // UI dependencies
            showNotification: dependencies.showNotification || this.fallbackNotification.bind(this),
            showConfirmationModal: dependencies.showConfirmationModal || this.fallbackConfirmation.bind(this),
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),

            // Advanced panel dependencies (optional)
            isOverlayActive: dependencies.isOverlayActive || (() => false),

            // Utilities (optional)
            escapeHtml: dependencies.escapeHtml || null,
            syncRecurringStateToDOM: dependencies.syncRecurringStateToDOM || null,
            refreshTaskButtonsForModeChange: dependencies.refreshTaskButtonsForModeChange || null,

            // Event listener utility (prevents duplicates)
            safeAddEventListener: dependencies.safeAddEventListener || ((el, ev, handler) => {
                if (!el) return;
                el.removeEventListener(ev, handler);
                el.addEventListener(ev, handler);
            })
        };

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

    /**
     * Event delegation for monthly day boxes
     * ✅ Replaces 31 listeners with 1
     */
    setupMonthlyDayDelegation() {
        const container = this.deps.querySelector(".monthly-days");
        if (!container) return;

        this.deps.safeAddEventListener(container, "click", (event) => {
            const dayBox = event.target.closest(".monthly-day-box");
            if (!dayBox) return;

            dayBox.classList.toggle("selected");
        });
    }

    /**
     * Event delegation for weekly day boxes
     * ✅ Replaces 7 listeners with 1
     */
    setupWeeklyDayDelegation() {
        const container = this.deps.querySelector(".weekly-days");
        if (!container) return;

        this.deps.safeAddEventListener(container, "click", (event) => {
            const dayBox = event.target.closest(".weekly-day-box");
            if (!dayBox) return;

            dayBox.classList.toggle("selected");
        });
    }

    /**
     * Event delegation for yearly month boxes
     * ✅ Replaces 12 listeners with 1
     */
    setupYearlyMonthDelegation() {
        const container = this.deps.querySelector(".yearly-months");
        if (!container) return;

        this.deps.safeAddEventListener(container, "click", (event) => {
            const monthBox = event.target.closest(".yearly-month-box");
            if (!monthBox) return;

            // Toggle selection
            monthBox.classList.toggle("selected");

            const selectedMonths = this.getSelectedYearlyMonths();

            // Reveal or hide the specific-days checkbox label
            const specificDaysLabel = this.deps.getElementById("yearly-specific-days-label");
            if (specificDaysLabel) {
                specificDaysLabel.classList.toggle("hidden", selectedMonths.length === 0);
            }

            // Show/hide day container based on selection + checkbox state
            const yearlySpecificDaysCheckbox = this.deps.getElementById("yearly-specific-days");
            const yearlyDayContainer = this.deps.getElementById("yearly-day-container");

            if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
                const shouldShow = yearlySpecificDaysCheckbox.checked && selectedMonths.length > 0;
                yearlyDayContainer.classList.toggle("hidden", !shouldShow);
            }

            // Update dropdown
            const yearlyMonthSelect = this.deps.getElementById("yearly-month-select");
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
     * ✅ Replaces 31 listeners with 1 (with complex apply-to-all logic)
     */
    setupYearlyDayDelegation() {
        const container = this.deps.getElementById("yearly-day-container");
        if (!container) return;

        this.deps.safeAddEventListener(container, "click", (event) => {
            const dayBox = event.target.closest(".yearly-day-box");
            if (!dayBox) return;

            const day = parseInt(dayBox.getAttribute("data-day"));
            if (isNaN(day)) return;

            dayBox.classList.toggle("selected");
            const isNowSelected = dayBox.classList.contains("selected");

            // Get current state
            const applyToAll = this.deps.getElementById("yearly-apply-all")?.checked || false;
            const monthNumber = parseInt(this.deps.getElementById("yearly-month-select")?.value);
            const activeMonths = this.getSelectedYearlyMonths();

            if (applyToAll) {
                // Update shared days
                const sharedDays = this.state.selectedYearlyDays["all"] || [];
                if (isNowSelected && !sharedDays.includes(day)) {
                    sharedDays.push(day);
                } else if (!isNowSelected && sharedDays.includes(day)) {
                    const idx = sharedDays.indexOf(day);
                    sharedDays.splice(idx, 1);
                }

                this.state.selectedYearlyDays["all"] = sharedDays;

                // Sync all selected months
                activeMonths.forEach(month => {
                    this.state.selectedYearlyDays[month] = [...sharedDays];
                });
            } else {
                // Regular mode, per-month
                const current = this.state.selectedYearlyDays[monthNumber] || [];
                if (isNowSelected && !current.includes(day)) {
                    current.push(day);
                } else if (!isNowSelected && current.includes(day)) {
                    const idx = current.indexOf(day);
                    current.splice(idx, 1);
                }
                this.state.selectedYearlyDays[monthNumber] = current;
            }
        });
    }

    /**
     * Event delegation for task list items
     * ✅ Replaces N×3 listeners (checkbox, remove, row click) with 1 delegated listener
     */
    setupTaskListDelegation() {
        const container = this.deps.getElementById("recurring-task-list");
        if (!container) return;

        this.deps.safeAddEventListener(container, "click", (event) => {
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
                if (taskId && this.deps.AppState?.isReady?.()) {
                    // Get template from recurringTemplates (not tasks array)
                    const currentState = this.deps.AppState.get();
                    const activeCycleId = currentState.appState?.activeCycleId;
                    const currentCycle = currentState.data?.cycles?.[activeCycleId];
                    const template = currentCycle?.recurringTemplates?.[taskId];

                    if (template) {
                        this.handleRemoveTask(template, item);
                    }
                }
                return;
            }

            // Handle row click for selection
            this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
                el.classList.remove("selected");
            });
            item.classList.add("selected");

            const taskId = item.getAttribute("data-task-id");
            this.state.selectedTaskId = taskId;

            // Get fresh data from AppState - ONLY use recurringTemplates
            if (this.deps.AppState?.isReady?.()) {
                const currentState = this.deps.AppState.get();
                const activeCycleId = currentState.appState?.activeCycleId;
                const currentCycle = currentState.data?.cycles?.[activeCycleId];

                // Get task from recurringTemplates ONLY (independent from tasks array)
                const template = currentCycle?.recurringTemplates?.[taskId];

                if (template) {
                    // Use the template directly (it has all needed properties)
                    this.showTaskSummaryPreview(template);
                } else {
                    console.warn('⚠️ Template not found for task:', taskId);
                }
            }
        });
    }

    // ============================================
    // FALLBACK METHODS
    // ============================================

    fallbackApplySettings(taskId, settings) {
        console.warn('⚠️ applyRecurringSettings not available - using fallback');
        console.log('Would apply settings to task:', taskId, settings);
    }

    fallbackDeleteTemplate(taskId) {
        console.warn('⚠️ deleteTemplate not available - using fallback');
        console.log('Would delete template:', taskId);
    }

    fallbackBuildSummary(settings) {
        console.warn('⚠️ buildRecurringSummary not available - using fallback');
        return `Recurring ${settings.frequency || 'daily'}`;
    }

    fallbackNormalize(settings) {
        console.warn('⚠️ normalizeRecurringSettings not available - using fallback');
        return settings;
    }

    fallbackFormatNext(timestamp) {
        console.warn('⚠️ formatNextOccurrence not available - using fallback');
        return timestamp ? new Date(timestamp).toLocaleDateString() : 'Not scheduled';
    }

    fallbackCalculateNext(settings, fromTime) {
        console.warn('⚠️ calculateNextOccurrence not available - using fallback');
        return null;
    }

    fallbackNotification(message, type) {
        console.log(`[Panel Notification] ${message}`);
    }

    fallbackConfirmation(options) {
        console.log(`[Panel Confirmation] ${options.message}`);
        const confirmed = confirm(options.message);
        if (options.callback) options.callback(confirmed);
    }

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
            const overlay = this.deps.getElementById("recurring-panel-overlay");
            const panel = this.deps.getElementById("recurring-panel");
            const closeBtn = this.deps.getElementById("close-recurring-panel");
            const openBtn = this.deps.getElementById("open-recurring-panel");

            if (!overlay || !panel || !closeBtn || !openBtn) {
                console.warn('⚠️ Recurring panel elements not found in DOM');
                return;
            }

            // Open panel button
            this.deps.safeAddEventListener(openBtn, "click", () => this.openPanel());

            // Close panel button
            this.deps.safeAddEventListener(closeBtn, "click", () => this.closePanel());

            // Close on overlay click
            this.deps.safeAddEventListener(overlay, "click", (e) => {
                if (e.target === overlay) {
                    this.closePanel();
                }
            });

            // Setup change recurring settings button
            const changeSettingsBtn = this.deps.getElementById("change-recurring-settings");
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
            const yearlyMonthSelect = this.deps.getElementById("yearly-month-select");
            if (yearlyMonthSelect) {
                this.deps.safeAddEventListener(yearlyMonthSelect, "change", (e) => {
                    const selectedMonth = parseInt(e.target.value);
                    this.generateYearlyDayGrid(selectedMonth);
                });
                this.generateYearlyDayGrid(1);
            }

            const yearlyApplyToAllCheckbox = this.deps.getElementById("yearly-apply-days-to-all");
            if (yearlyApplyToAllCheckbox) {
                this.deps.safeAddEventListener(yearlyApplyToAllCheckbox, "change", () => {
                    this.handleYearlyApplyToAllChange();
                });
            }

            const yearlySpecificDaysCheckbox = this.deps.getElementById("yearly-specific-days");
            const yearlyDayContainer = this.deps.getElementById("yearly-day-container");
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

            this.state.isInitialized = true;
            console.log('✅ Recurring panel setup complete');

        } catch (error) {
            console.error('❌ Error setting up recurring panel:', error);
            this.deps.showNotification('Panel setup failed - using degraded mode', 'warning');
        }
    }

    /**
     * Setup frequency selector dropdown
     */
    setupFrequencySelector() {
        const frequencySelect = this.deps.getElementById("recur-frequency");
        if (!frequencySelect) return;

        this.deps.safeAddEventListener(frequencySelect, "change", () => {
            const selectedFrequency = frequencySelect.value;
            const frequencyMap = {
                hourly: this.deps.getElementById("hourly-options"),
                daily: this.deps.getElementById("daily-options"),
                weekly: this.deps.getElementById("weekly-options"),
                biweekly: this.deps.getElementById("biweekly-options"),
                monthly: this.deps.getElementById("monthly-options"),
                yearly: this.deps.getElementById("yearly-options")
            };

            // Hide all frequency option sections
            Object.values(frequencyMap).forEach(section => {
                if (section) section.classList.add("hidden");
            });

            // Show selected frequency options
            if (frequencyMap[selectedFrequency]) {
                frequencyMap[selectedFrequency].classList.remove("hidden");
            }

            this.updateRecurringSummary();
        });
    }

    /**
     * Setup toggle visibility for various sections
     */
    setupToggleVisibility() {
        const toggleVisibility = (triggerId, contentId) => {
            const trigger = this.deps.getElementById(triggerId);
            const content = this.deps.getElementById(contentId);
            if (trigger && content) {
                this.deps.safeAddEventListener(trigger, "change", () => {
                    content.classList.toggle("hidden", !trigger.checked);
                });
            }
        };

        toggleVisibility("hourly-specific-time", "hourly-minute-container");
        toggleVisibility("daily-specific-time", "daily-time-container");
        toggleVisibility("weekly-specific-days", "weekly-day-container");
        toggleVisibility("weekly-specific-time", "weekly-time-container");
        toggleVisibility("biweekly-specific-days", "biweekly-day-container");
        toggleVisibility("biweekly-specific-time", "biweekly-time-container");
        toggleVisibility("monthly-specific-days", "monthly-day-container");
        toggleVisibility("monthly-week-of-month", "monthly-week-container");
        toggleVisibility("monthly-specific-time", "monthly-time-container");
        toggleVisibility("yearly-specific-months", "yearly-month-container");
        toggleVisibility("yearly-specific-time", "yearly-time-container");

        // Setup duration radio buttons
        this.setupDurationRadioButtons();

        // Setup mutual exclusivity for monthly options
        this.setupMonthlyMutualExclusion();
    }

    /**
     * Setup toggle check all button
     */
    setupToggleCheckAll() {
        const toggleBtn = this.deps.getElementById("toggle-check-all");
        if (!toggleBtn) return;

        this.deps.safeAddEventListener(toggleBtn, "click", () => {
            const checkboxes = this.deps.querySelectorAll(".recurring-check:not(.hidden)");
            const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);

            checkboxes.forEach(cb => {
                cb.checked = anyUnchecked;
                const item = cb.closest(".recurring-task-item");
                if (item) {
                    item.classList.toggle("checked", anyUnchecked);
                }
            });

            // Update button label
            toggleBtn.textContent = anyUnchecked ? "Uncheck All" : "Check All";

            this.updateRecurringSummary();
        });
    }

    /**
     * Setup advanced settings toggle
     */
    setupAdvancedToggle() {
        const toggleBtn = this.deps.getElementById("toggle-advanced-settings");
        if (!toggleBtn) return;

        let advancedVisible = false;

        const setAdvancedVisibility = (visible) => {
            toggleBtn.textContent = visible ? "Hide Advanced Options" : "Show Advanced Options";

            // Show/hide all `.frequency-options` panels
            this.deps.querySelectorAll(".frequency-options").forEach(option => {
                option.style.display = visible ? "block" : "none";
            });

            // Always show frequency dropdown container
            const frequencyContainer = this.deps.getElementById("recur-frequency-container");
            if (frequencyContainer) frequencyContainer.style.display = "block";

            // Handle extras like 'Recur indefinitely' and 'Specific Dates'
            const advancedControls = [
                { checkboxId: "recur-indefinitely" },
                { checkboxId: "recur-specific-dates" }
            ];

            advancedControls.forEach(({ checkboxId }) => {
                const checkbox = this.deps.getElementById(checkboxId);
                if (!checkbox) return;

                const label = checkbox.closest("label");
                if (label) {
                    label.style.display = visible ? "flex" : "none";
                }
            });

            const defaultBoxContainer = this.deps.getElementById("set-default-recurring-container");
            if (defaultBoxContainer) {
                defaultBoxContainer.style.display = visible ? "block" : "none";
            }
        };

        setAdvancedVisibility(advancedVisible);

        this.deps.safeAddEventListener(toggleBtn, "click", () => {
            advancedVisible = !advancedVisible;
            setAdvancedVisibility(advancedVisible);
        });
    }

    /**
     * Setup time conversion between 12hr and 24hr formats
     */
    setupTimeConversion({ hourInputId, minuteInputId, meridiemSelectId, militaryCheckboxId }) {
        const hourInput = this.deps.getElementById(hourInputId);
        const minuteInput = this.deps.getElementById(minuteInputId);
        const meridiemSelect = this.deps.getElementById(meridiemSelectId);
        const militaryToggle = this.deps.getElementById(militaryCheckboxId);

        if (!hourInput || !minuteInput || !meridiemSelect || !militaryToggle) return;

        this.deps.safeAddEventListener(militaryToggle, "change", () => {
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
     */
    setupMilitaryTimeToggle(prefix) {
        const toggle = this.deps.getElementById(`${prefix}-military`);
        const hourInput = this.deps.getElementById(`${prefix}-hour`);
        const meridiemSelect = this.deps.getElementById(`${prefix}-meridiem`);

        if (!toggle || !hourInput || !meridiemSelect) {
            console.warn(`⚠️ Missing elements for military time toggle: ${prefix}`);
            return;
        }

        this.deps.safeAddEventListener(toggle, "change", () => {
            const is24Hour = toggle.checked;

            try {
                hourInput.min = is24Hour ? 0 : 1;
                hourInput.max = is24Hour ? 23 : 12;
                meridiemSelect.classList.toggle("hidden", is24Hour);

                // Update summary when time format changes
                this.updateRecurringSummary();
            } catch (error) {
                console.warn(`⚠️ Error updating military time toggle for ${prefix}:`, error);
            }
        });
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
        // ✅ NO listeners added - handled by setupWeeklyDayDelegation()
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
        const checkbox = this.deps.getElementById("yearly-apply-days-to-all");
        const dropdown = this.deps.getElementById("yearly-month-select");
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
        const checkbox = this.deps.getElementById("recur-specific-dates");
        const panel = this.deps.getElementById("specific-dates-panel");
        const timeOptions = this.deps.getElementById("specific-date-time-options");
        const addBtn = this.deps.getElementById("add-specific-date");
        const list = this.deps.getElementById("specific-date-list");

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
            input.setAttribute("aria-label", isFirst ? "First specific date" : `Specific date ${index + 1}`);
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
                trash.innerHTML = "<i class='fas fa-trash recurring-date-trash-icon'></i>";
                trash.title = "Remove this date";

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

            this.deps.querySelectorAll(".frequency-options").forEach(panel => {
                panel.classList.add("hidden");
            });

            this.deps.getElementById("recur-frequency-container").classList.toggle("hidden", shouldShow);
            this.deps.getElementById("recur-indefinitely").closest("label").classList.toggle("hidden", shouldShow);

            const advancedBtn = this.deps.getElementById("toggle-advanced-settings");
            if (advancedBtn) {
                advancedBtn.classList.toggle("hidden", shouldShow);
            }

            if (shouldShow && list.children.length === 0) {
                createDateInput(true);
            }

            if (!shouldShow) {
                this.deps.getElementById("specific-date-specific-time").checked = false;
                this.deps.getElementById("specific-date-time-container").classList.add("hidden");

                const freqSelect = this.deps.getElementById("recur-frequency");
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

    /**
     * Update recurring settings panel visibility
     */
    updateRecurringSettingsVisibility() {
        const anySelected = this.deps.querySelector(".recurring-task-item.selected");
        const settingsPanel = this.deps.getElementById("recurring-settings-panel");
        const checkboxes = this.deps.querySelectorAll(".recurring-check");
        const changeBtns = this.deps.querySelectorAll(".change-recurring-btn");
        const toggleContainer = this.deps.getElementById("recurring-toggle-actions");
        const taskCount = this.deps.querySelectorAll(".recurring-task-item").length;

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
        toggleContainer?.classList.toggle("hidden", !shouldShowToggle);
    }

    /**
     * Setup Apply and Cancel button handlers
     */
    setupApplyCancelButtons() {
        const applyBtn = this.deps.getElementById("apply-recurring-settings");
        const cancelBtn = this.deps.getElementById("cancel-recurring-settings");

        if (applyBtn) {
            this.deps.safeAddEventListener(applyBtn, "click", () => this.handleApplySettings());
        }

        if (cancelBtn) {
            this.deps.safeAddEventListener(cancelBtn, "click", () => this.handleCancelSettings());
        }
    }

    /**
     * Handle applying recurring settings to checked tasks
     */
    async handleApplySettings() {
        console.log('📝 Applying recurring settings (AppState-based)...');

        try {
            // ✅ Wait for core systems to be ready (AppState + data)
            await this.deps.appInit?.waitForCore();

            const state = this.deps.AppState.get();
            const activeCycleId = state.appState?.activeCycleId;

            if (!activeCycleId) {
                this.deps.showNotification("⚠ No active cycle found.");
                return;
            }

            const cycleData = state.data?.cycles?.[activeCycleId];
            if (!cycleData) {
                this.deps.showNotification("⚠ Active cycle data not found.");
                return;
            }

            const checkedEls = this.deps.querySelectorAll(".recurring-check:checked");

            if (!checkedEls.length) {
                this.deps.showNotification("⚠ No tasks checked to apply settings.");
                return;
            }

            const settings = this.deps.normalizeRecurringSettings(this.buildRecurringSettingsFromPanel());

            // Set defaultRecurTime if not using specific time
            if (!settings.specificTime && !settings.defaultRecurTime) {
                settings.defaultRecurTime = new Date().toISOString();
            }

            // Batch all updates in one AppState operation (DI-pure)
            // ✅ CRITICAL: Await the update to ensure state is saved before re-rendering
            if (this.deps.updateAppState) {
                await this.deps.updateAppState(draft => {
                    // Save default recurring settings if requested
                    if (this.deps.getElementById("set-default-recurring")?.checked) {
                        if (!draft.settings) draft.settings = {};
                        draft.settings.defaultRecurringSettings = settings;
                    }

                    const cycle = draft.data.cycles[activeCycleId];
                    if (!cycle.recurringTemplates) {
                        cycle.recurringTemplates = {};
                    }

                    checkedEls.forEach(checkbox => {
                        const taskEl = checkbox.closest("[data-task-id]");
                        const taskId = taskEl?.dataset.taskId;
                        if (!taskId || !taskEl) return;

                        // Check if task exists in task list
                        let task = cycle.tasks.find(t => t.id === taskId);

                        // ✅ ONLY update task if it exists in the task list
                        // DON'T create new tasks - let the watch function handle that
                        if (task) {
                            // Apply recurring settings to existing task
                            task.recurring = true;
                            task.schemaVersion = 2;
                            task.recurringSettings = structuredClone(settings);
                        }

                        // ✅ ALWAYS update the template (this is the important part)
                        // Get template data (either from existing task or from template)
                        const existingTemplate = cycle.recurringTemplates[taskId];
                        const templateText = task?.text ||
                                           existingTemplate?.text ||
                                           taskEl.querySelector(".recurring-task-text")?.textContent ||
                                           "Untitled Task";

                        cycle.recurringTemplates[taskId] = {
                            id: taskId,
                            text: templateText,
                            dueDate: task?.dueDate || existingTemplate?.dueDate || null,
                            highPriority: task?.highPriority || existingTemplate?.highPriority || false,
                            remindersEnabled: task?.remindersEnabled || existingTemplate?.remindersEnabled || false,
                            recurring: true,
                            recurringSettings: structuredClone(settings),
                            nextScheduledOccurrence: this.deps.calculateNextOccurrence(settings, Date.now()),
                            schemaVersion: 2
                        };
                    });
                }, true); // ✅ Immediate save to prevent data loss on browser crash
            }

            // Update DOM after state changes (DI-pure)
            if (this.deps.syncRecurringStateToDOM) {
                checkedEls.forEach(checkbox => {
                    const taskEl = checkbox.closest("[data-task-id]");
                    if (!taskEl) return;

                    // Update DOM
                    taskEl.classList.add("recurring");
                    taskEl.setAttribute("data-recurring-settings", JSON.stringify(settings));
                    const recurringBtn = taskEl.querySelector(".recurring-btn");
                    if (recurringBtn) {
                        recurringBtn.classList.add("active");
                        recurringBtn.setAttribute("aria-pressed", "true");
                    }

                    this.deps.syncRecurringStateToDOM(taskEl, settings);
                });
            }

            // Show success notifications
            if (this.deps.getElementById("set-default-recurring")?.checked) {
                this.deps.showNotification("✅ Default recurring settings saved!", "success", 1500);
            }

            this.updateRecurringSummary();
            this.deps.showNotification("✅ Recurring settings applied!", "success", 2000);
            await this.updateRecurringPanel();

            // ✅ Use setTimeout to ensure DOM has updated before querying for checked tasks
            setTimeout(() => {
                // ✅ Keep first checked task selected and show updated preview
                const checkedTasks = this.deps.querySelectorAll(".recurring-task-item.checked");
                let firstCheckedTask = null;

                console.log('🔍 Looking for checked tasks after apply:', checkedTasks.length);

                if (checkedTasks.length > 0) {
                    firstCheckedTask = checkedTasks[0];

                    // Keep first task selected, clear the rest
                    this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
                        if (el !== firstCheckedTask) {
                            el.classList.remove("selected", "checked");
                        }
                    });

                    // Update preview with new settings
                    const taskId = firstCheckedTask.dataset.taskId;
                    const state = this.deps.AppState.get();
                    const activeCycleId = state.appState?.activeCycleId;
                    const task = state.data?.cycles?.[activeCycleId]?.tasks.find(t => t.id === taskId);

                    if (task) {
                        this.showTaskSummaryPreview(task);
                        console.log('✅ Updated preview with new settings for task:', taskId);

                        // ✅ Debug: Check if preview is visible
                        const summaryContainer = this.deps.getElementById("recurring-summary-preview");
                        console.log('🔍 Preview container visibility after apply:', {
                            exists: !!summaryContainer,
                            hasHiddenClass: summaryContainer?.classList.contains("hidden"),
                            innerHTML: summaryContainer?.innerHTML.substring(0, 100)
                        });
                    }
                } else {
                    // No checked tasks - clear all selections
                    this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
                        el.classList.remove("selected", "checked");
                    });
                    console.log('⚠️ No checked tasks found after apply settings');
                }
            }, 10);

            const settingsPanel = this.deps.getElementById("recurring-settings-panel");
            settingsPanel?.classList.add("hidden");

            // Explicitly hide checkboxes and toggle container
            this.deps.querySelectorAll(".recurring-check").forEach(cb => {
                cb.classList.add("hidden");
                cb.checked = false;
            });

            const toggleContainer = this.deps.getElementById("recurring-toggle-actions");
            toggleContainer?.classList.add("hidden");

            // Update button visibility
            this.updateRecurringPanelButtonVisibility();

            // Clear the form
            this.clearRecurringForm();

            console.log('✅ Recurring settings applied successfully');

        } catch (error) {
            console.error('❌ Failed to apply recurring settings:', error);
            this.deps.showNotification('❌ Failed to apply settings. Please try again.', 'error', 5000);

            // Cleanup on error: hide settings panel and reset form
            const settingsPanel = this.deps.getElementById("recurring-settings-panel");
            if (settingsPanel) {
                settingsPanel.classList.add("hidden");
            }

            // Reset checkboxes
            this.deps.querySelectorAll(".recurring-check").forEach(cb => {
                cb.classList.add("hidden");
                cb.checked = false;
            });

            // Re-throw to allow caller to handle if needed
            throw error;
        }
    }

    /**
     * Handle canceling recurring settings changes
     */
    handleCancelSettings() {
        const settingsPanel = this.deps.getElementById("recurring-settings-panel");
        settingsPanel?.classList.add("hidden");

        // Deselect all selected tasks
        this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
            el.classList.remove("selected");
            const checkbox = el.querySelector("input[type='checkbox']");
            if (checkbox) checkbox.checked = false;
        });

        // Hide checkboxes and uncheck them
        this.deps.querySelectorAll(".recurring-check").forEach(cb => {
            cb.checked = false;
            cb.classList.add("hidden");
            cb.closest(".recurring-task-item")?.classList.remove("checked");
        });

        // Hide the summary preview if visible
        const preview = this.deps.getElementById("recurring-summary-preview");
        if (preview) preview.classList.add("hidden");

        this.updateRecurringSettingsVisibility();
    }

    /**
     * Setup biweekly day toggle
     */
    setupBiweeklyDayToggle() {
        this.deps.querySelectorAll(".biweekly-day-box").forEach(box => {
            this.deps.safeAddEventListener(box, "click", () => {
                box.classList.toggle("selected");
            });
        });
    }

    /**
     * Setup duration options (indefinitely checkbox, count/until radio buttons)
     */
    setupDurationRadioButtons() {
        const indefinitelyCheckbox = this.deps.getElementById("recur-indefinitely");
        const limitedContainer = this.deps.getElementById("recur-limited-container");
        const countRadio = this.deps.getElementById("recur-count-radio");
        const untilRadio = this.deps.getElementById("recur-until-radio");
        const countContainer = this.deps.getElementById("recur-count-container");
        const untilContainer = this.deps.getElementById("recur-until-container");

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
     */
    setupMonthlyMutualExclusion() {
        const specificDays = this.deps.getElementById("monthly-specific-days");
        const weekOfMonth = this.deps.getElementById("monthly-week-of-month");

        if (!specificDays || !weekOfMonth) return;

        this.deps.safeAddEventListener(specificDays, "change", () => {
            if (specificDays.checked && weekOfMonth.checked) {
                weekOfMonth.checked = false;
                const weekContainer = this.deps.getElementById("monthly-week-container");
                if (weekContainer) weekContainer.classList.add("hidden");
            }
        });

        this.deps.safeAddEventListener(weekOfMonth, "change", () => {
            if (weekOfMonth.checked && specificDays.checked) {
                specificDays.checked = false;
                const dayContainer = this.deps.getElementById("monthly-day-container");
                if (dayContainer) dayContainer.classList.add("hidden");
            }
        });
    }

    /**
     * Setup additional event listeners for recurring panel
     */
    setupAdditionalListeners() {
        // Specific date time checkbox
        const specificDateTime = this.deps.getElementById("specific-date-specific-time");
        if (specificDateTime) {
            this.deps.safeAddEventListener(specificDateTime, "change", (e) => {
                const timeContainer = this.deps.getElementById("specific-date-time-container");
                if (timeContainer) {
                    timeContainer.classList.toggle("hidden", !e.target.checked);
                }
                this.updateRecurringSummary();
            });
        }

        // Duration radio buttons summary update
        ['recur-indefinitely', 'recur-count-radio', 'recur-until-radio'].forEach(id => {
            const radio = this.deps.getElementById(id);
            if (radio) {
                this.deps.safeAddEventListener(radio, "change", () => {
                    this.updateRecurCountVisibility();
                    this.updateRecurringSummary();
                });
            }
        });

        // Document click handler for hiding preview when clicking outside
        this.deps.safeAddEventListener(document, "click", (e) => {
            const overlay = this.deps.getElementById("recurring-panel-overlay");
            if (!overlay || overlay.classList.contains("hidden")) return;

            const taskList = this.deps.getElementById("recurring-task-list");
            const settingsPanel = this.deps.getElementById("recurring-settings-panel");
            const summaryPreview = this.deps.getElementById("recurring-summary-preview");

            if (taskList?.contains(e.target) || settingsPanel?.contains(e.target)) return;

            // Hide summary preview when clicking outside
            if (summaryPreview && !summaryPreview.contains(e.target) && !taskList?.contains(e.target)) {
                summaryPreview.classList.add("hidden");
                this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
                    el.classList.remove("selected");
                });
            }
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
            const overlay = this.deps.getElementById("recurring-panel-overlay");
            if (overlay) {
                overlay.classList.remove("hidden");
            }

            // Hide settings panel initially
            const settingsPanel = this.deps.getElementById("recurring-settings-panel");
            if (settingsPanel) {
                settingsPanel.classList.add("hidden");
            }

            this.updateRecurringSettingsVisibility();

            this.state.panelOpen = true;
            console.log('✅ Recurring panel opened successfully');

        } catch (error) {
            console.error('❌ Error opening recurring panel:', error);
            this.deps.showNotification('Failed to open panel', 'error');
        }
    }

    /**
     * Close the recurring panel
     */
    closePanel() {
        console.log('🔁 Closing recurring panel...');

        try {
            const overlay = this.deps.getElementById("recurring-panel-overlay");
            if (overlay) {
                overlay.classList.add("hidden");
            }

            // ✅ Hide the preview when panel closes
            const summaryContainer = this.deps.getElementById("recurring-summary-preview");
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
            const recurringList = this.deps.getElementById("recurring-task-list");
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

            if (recurringTasks.length === 0) {
                console.log('📋 No recurring tasks found, hiding panel');
                const overlay = this.deps.getElementById("recurring-panel-overlay");
                if (overlay) overlay.classList.add("hidden");
                
                // ✅ Hide preview when no tasks
                const summaryContainer = this.deps.getElementById("recurring-summary-preview");
                if (summaryContainer) {
                    summaryContainer.classList.add("hidden");
                }
                return;
            }

            // Remember previously selected task AND checked tasks
            const previouslySelectedId = this.state.selectedTaskId;
            const previouslyCheckedIds = Array.from(
                this.deps.querySelectorAll(".recurring-task-item.checked")
            ).map(el => el.dataset.taskId);

            // Clear previous selections
            this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
                el.classList.remove("selected");
            });

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
                    const checkbox = item.querySelector(".recurring-check");
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                }
            });

            this.updateRecurringSummary();
            console.log('✅ Recurring panel updated successfully');

        } catch (error) {
            console.error('❌ Error updating recurring panel:', error);
            this.deps.showNotification('Panel update failed', 'warning');
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

        // ✅ XSS PROTECTION: Escape HTML in task text (DI-pure)
        const escapedTaskText = typeof this.deps.escapeHtml === 'function'
            ? this.deps.escapeHtml(task.text)
            : task.text;

        item.innerHTML = `
            <input type="checkbox"
                   class="recurring-check"
                   id="recurring-check-${task.id}"
                   name="recurring-check-${task.id}"
                   aria-label="Mark this task temporarily">
            <span class="recurring-task-text">${escapedTaskText}</span>
            <button title="Remove from Recurring" class="recurring-remove-btn">
              <i class='fas fa-trash recurring-trash-icon'></i>
            </button>
        `;

        // ✅ MEMORY LEAK FIX: No listeners added - handled by setupTaskListDelegation()
        // Checkbox is hidden by default
        const checkbox = item.querySelector(".recurring-check");
        checkbox.classList.add("hidden");

        return item;
    }

    /**
     * Handle remove task from recurring
     * @param {Object} task - The task to remove
     * @param {HTMLElement} item - The list item element
     */
    handleRemoveTask(task, item) {
        this.deps.showConfirmationModal({
            title: "Remove Recurring Task",
            message: `Are you sure you want to remove "${task.text}" from recurring tasks?`,
            confirmText: "Remove",
            cancelText: "Cancel",
            callback: (confirmed) => {
                if (!confirmed) return;

                try {
                    // ✅ Use AppState instead of direct localStorage manipulation
                    if (!this.deps.AppState?.isReady?.()) {
                        console.error('❌ AppState not ready for task removal');
                        this.deps.showNotification('App not ready, please try again', 'error');
                        return;
                    }

                    const state = this.deps.AppState.get();
                    const activeCycleId = state.appState?.activeCycleId;

                    if (!activeCycleId) {
                        console.error('❌ No active cycle found for task removal');
                        this.deps.showNotification('No active cycle found', 'error');
                        return;
                    }

                    // ✅ Update via AppState instead of direct manipulation (immediate save)
                    this.deps.updateAppState(draft => {
                        const cycle = draft.data.cycles[activeCycleId];

                        // Remove recurrence from the live task
                        const liveTask = cycle.tasks.find(t => t.id === task.id);
                        if (liveTask) {
                            liveTask.recurring = false;
                            delete liveTask.recurringSettings;
                        }

                        // Delete from recurringTemplates
                        if (cycle.recurringTemplates?.[task.id]) {
                            delete cycle.recurringTemplates[task.id];
                        }
                    }, true); // ✅ Immediate save when removing recurring from panel

                    this.deps.showNotification("↩️ Recurring turned off for this task.", "info", 5000);

                    // Remove recurring visual state
                    const matchingTaskItem = this.deps.querySelector(`.task[data-task-id="${task.id}"]`);
                    if (matchingTaskItem) {
                        const recurringBtn = matchingTaskItem.querySelector(".recurring-btn");
                        if (recurringBtn) {
                            recurringBtn.classList.remove("active");
                            recurringBtn.setAttribute("aria-pressed", "false");
                            recurringBtn.disabled = false;
                        }
                        matchingTaskItem.classList.remove("recurring");
                        matchingTaskItem.removeAttribute("data-recurring-settings");
                    }

                    item.remove();
                    this.updateRecurringPanelButtonVisibility();

                    // ✅ Check remaining templates via AppState
                    const updatedState = this.deps.AppState.get();
                    const updatedCycle = updatedState.data?.cycles?.[activeCycleId];
                    const remaining = Object.values(updatedCycle?.recurringTemplates || {});
                    if (remaining.length === 0) {
                        const overlay = this.deps.getElementById("recurring-panel-overlay");
                        if (overlay) overlay.classList.add("hidden");
                    }

                    // Update undo/redo buttons
                    const undoBtn = this.deps.getElementById("undo-btn");
                    const redoBtn = this.deps.getElementById("redo-btn");
                    if (undoBtn) undoBtn.hidden = false;
                    if (redoBtn) redoBtn.hidden = true;

                } catch (error) {
                    console.error('❌ Error removing recurring task:', error);
                    this.deps.showNotification('Failed to remove task', 'error');
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
            const anySelected = this.deps.querySelector(".recurring-task-item.selected");
            const settingsPanel = this.deps.getElementById("recurring-settings-panel");
            const checkboxes = this.deps.querySelectorAll(".recurring-check");
            const changeBtns = this.deps.querySelectorAll(".change-recurring-btn");
            const toggleContainer = this.deps.getElementById("recurring-toggle-actions");
            const toggleBtn = this.deps.getElementById("toggle-check-all");
            const taskCount = this.deps.querySelectorAll(".recurring-task-item").length;

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
                toggleBtn.textContent = anyUnchecked ? "Check All" : "Uncheck All";
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

            let summaryContainer = this.deps.getElementById("recurring-summary-preview");
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
            const previewText = this.deps.getElementById("recurring-preview-text");
            if (!previewText) {
                console.warn('⚠️ recurring-preview-text element not found');
                return;
            }

            // ✅ XSS PROTECTION: Escape HTML in task text (DI-pure)
            const escapedTaskText = typeof this.deps.escapeHtml === 'function'
                ? this.deps.escapeHtml(task.text)
                : task.text;

            if (!recurringSettings) {
                previewText.innerHTML = `
                    <strong>${escapedTaskText}</strong><br>
                    <em>No recurring settings configured</em>
                `;
                return;
            }

            const summaryText = this.deps.buildRecurringSummary(recurringSettings);

            // ✅ Get next occurrence text
            const nextOccurrenceText = template?.nextScheduledOccurrence
                ? this.deps.formatNextOccurrence(template.nextScheduledOccurrence)
                : null;

            previewText.innerHTML = `
                <strong>${escapedTaskText}</strong><br>
                <span class="recurring-summary-text">${summaryText}</span>
                ${nextOccurrenceText ? `<br><span class="next-occurrence-text">${nextOccurrenceText}</span>` : ''}
            `;

            // ✅ Only show button if settings panel is NOT currently open
            const changeBtn = this.deps.getElementById("change-recurring-settings");
            const settingsPanel = this.deps.getElementById("recurring-settings-panel");
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
        changeBtn.textContent = 'Change Recurring Settings';

        // Attach click listener to button
        this.deps.safeAddEventListener(changeBtn, 'click', () => {
            console.log('🔧 Change recurring settings clicked');
            if (this.state.selectedTaskId) {
                this.openRecurringSettingsPanelForTask(this.state.selectedTaskId);
            } else {
                console.warn('⚠️ No task selected for changing settings');
            }
        });

        summaryBox.appendChild(previewText);
        summaryBox.appendChild(changeBtn);
        container.appendChild(summaryBox);

        const panel = this.deps.getElementById('recurring-panel');
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
            const summaryEl = this.deps.getElementById("recurring-summary");
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
     * Shows button only when there are recurring tasks
     */
    updateRecurringPanelButtonVisibility() {
        try {
            const panelButton = this.deps.getElementById("open-recurring-panel");
            if (!panelButton) {
                console.warn('⚠️ Recurring panel button not found in DOM');
                return;
            }

            let hasRecurring = false;

            try {
                // ✅ Use AppState instead of loadData
                if (!this.deps.AppState?.isReady?.()) {
                    console.warn('⚠️ AppState not ready for button visibility check');
                    panelButton.classList.add("hidden"); // Hide by default
                    return;
                }

                const state = this.deps.AppState.get();
                const activeCycleId = state?.appState?.activeCycleId;
                const currentCycle = state?.data?.cycles?.[activeCycleId];

                if (currentCycle?.recurringTemplates) {
                    const templateCount = Object.keys(currentCycle.recurringTemplates).length;
                    hasRecurring = templateCount > 0;

                    console.log('🔍 Recurring button visibility:', {
                        activeCycleId,
                        templateCount,
                        willShow: hasRecurring
                    });
                }
            } catch (error) {
                console.warn('⚠️ Could not check recurring tasks:', error);
                panelButton.classList.add("hidden"); // Hide on error
                return;
            }

            // Toggle visibility
            panelButton.classList.toggle("hidden", !hasRecurring);
            console.log(`🔘 Recurring button ${hasRecurring ? 'SHOWN' : 'HIDDEN'}`);

        } catch (error) {
            console.error('❌ Error updating panel button visibility:', error);
        }
    }

    // ============================================
    // ALWAYS SHOW RECURRING SETTING
    // ============================================

    /**
     * Save always show recurring setting to AppState
     */
    saveAlwaysShowRecurringSetting() {
        console.log('💾 Saving always show recurring setting...');

        try {
            const checkbox = this.deps.getElementById("always-show-recurring");
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

            this.deps.updateAppState(draft => {
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

            const checkbox = this.deps.getElementById("always-show-recurring");
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
        console.log('🔗 Attaching recurring summary listeners...');

        try {
            const panel = this.deps.getElementById("recurring-settings-panel");
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
        const checkbox = this.deps.getElementById("always-show-recurring");
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
            const itemToSelect = this.deps.querySelector(`.recurring-task-item[data-task-id="${taskIdToPreselect}"]`);
            if (itemToSelect) {
                itemToSelect.classList.add("selected");

                const checkbox = itemToSelect.querySelector("input[type='checkbox']");
                if (checkbox) {
                    checkbox.checked = true;
                    itemToSelect.classList.add("checked");
                }

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
            const overlay = this.deps.getElementById("recurring-panel-overlay");
            if (overlay) overlay.classList.remove("hidden");

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

/**
 * Load sub-modules with version cache-busting
 * @param {string} version - Version string for cache-busting
 */
export async function loadPanelSubModules(version) {
    if (_buildRecurringSummaryFromSettings) {
        return; // Already loaded
    }

    console.log(`Loading recurringPanel sub-modules with v=${version}...`);

    const [summaryModule, gridsModule, formModule, eventsModule] = await Promise.all([
        import(`./recurringPanelSummary.js?v=${version}`),
        import(`./recurringPanelGrids.js?v=${version}`),
        import(`./recurringPanelForm.js?v=${version}`),
        import(`./recurringPanelEvents.js?v=${version}`)
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
