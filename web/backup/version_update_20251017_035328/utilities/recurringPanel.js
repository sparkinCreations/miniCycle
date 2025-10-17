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
 * @version 1.325
 * @requires recurringCore (via dependency injection)
 * @requires AppInit (for initialization coordination)
 */

import { appInit } from './appInitialization.js';
import { formatNextOccurrence, calculateNextOccurrence } from './recurringCore.js';

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

        // Store dependencies with intelligent fallbacks
        this.deps = {
            // From recurringCore module
            applyRecurringSettings: dependencies.applyRecurringSettings || this.fallbackApplySettings.bind(this),
            deleteTemplate: dependencies.deleteTemplate || this.fallbackDeleteTemplate.bind(this),
            buildRecurringSummary: dependencies.buildRecurringSummary || this.fallbackBuildSummary.bind(this),
            normalizeRecurringSettings: dependencies.normalizeRecurringSettings || this.fallbackNormalize.bind(this),

            // State management
            getAppState: dependencies.getAppState || (() => window.AppState?.get()),
            updateAppState: dependencies.updateAppState || ((updateFn) => window.AppState?.update(updateFn)),
            isAppStateReady: dependencies.isAppStateReady || (() => window.AppState?.isReady()),
            loadData: dependencies.loadData || (() => window.loadMiniCycleData?.()),

            // UI dependencies
            showNotification: dependencies.showNotification || this.fallbackNotification.bind(this),
            showConfirmationModal: dependencies.showConfirmationModal || this.fallbackConfirmation.bind(this),
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),

            // Advanced panel dependencies (optional)
            isOverlayActive: dependencies.isOverlayActive || (() => false)
        };

        // Internal state
        this.state = {
            isInitialized: false,
            panelOpen: false,
            selectedTaskId: null,
            selectedYearlyDays: {} // key = month number, value = array of selected days
        };

        console.log('✅ RecurringPanelManager initialized');
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
            openBtn.addEventListener("click", () => this.openPanel());

            // Close panel button
            closeBtn.addEventListener("click", () => this.closePanel());

            // Close on overlay click
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    this.closePanel();
                }
            });

            // Setup change recurring settings button
            const changeSettingsBtn = this.deps.getElementById("change-recurring-settings");
            if (changeSettingsBtn) {
                changeSettingsBtn.addEventListener("click", () => {
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
                yearlyMonthSelect.addEventListener("change", (e) => {
                    const selectedMonth = parseInt(e.target.value);
                    this.generateYearlyDayGrid(selectedMonth);
                });
                this.generateYearlyDayGrid(1);
            }

            const yearlyApplyToAllCheckbox = this.deps.getElementById("yearly-apply-days-to-all");
            if (yearlyApplyToAllCheckbox) {
                yearlyApplyToAllCheckbox.addEventListener("change", () => {
                    this.handleYearlyApplyToAllChange();
                });
            }

            const yearlySpecificDaysCheckbox = this.deps.getElementById("yearly-specific-days");
            const yearlyDayContainer = this.deps.getElementById("yearly-day-container");
            if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
                yearlySpecificDaysCheckbox.addEventListener("change", () => {
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

        frequencySelect.addEventListener("change", () => {
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
                trigger.addEventListener("change", () => {
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
        toggleVisibility("monthly-specific-time", "monthly-time-container");
        toggleVisibility("yearly-specific-months", "yearly-month-container");
        toggleVisibility("yearly-specific-time", "yearly-time-container");
    }

    /**
     * Setup toggle check all button
     */
    setupToggleCheckAll() {
        const toggleBtn = this.deps.getElementById("toggle-check-all");
        if (!toggleBtn) return;

        toggleBtn.addEventListener("click", () => {
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

        toggleBtn.addEventListener("click", () => {
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

        militaryToggle.addEventListener("change", () => {
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

        toggle.addEventListener("change", () => {
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
     */
    generateMonthlyDayGrid() {
        const container = this.deps.querySelector(".monthly-days");
        if (!container) return;

        container.innerHTML = "";

        for (let i = 1; i <= 31; i++) {
            const dayBox = document.createElement("div");
            dayBox.className = "monthly-day-box";
            dayBox.setAttribute("data-day", i);
            dayBox.textContent = i;

            dayBox.addEventListener("click", () => {
                dayBox.classList.toggle("selected");
            });

            container.appendChild(dayBox);
        }
    }

    /**
     * Setup weekly day toggle handlers
     */
    setupWeeklyDayToggle() {
        this.deps.querySelectorAll(".weekly-day-box").forEach(box => {
            box.addEventListener("click", () => {
                box.classList.toggle("selected");
            });
        });
    }

    /**
     * Generate yearly month selection grid
     */
    generateYearlyMonthGrid() {
        const container = this.deps.querySelector(".yearly-months");
        if (!container) return;

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        container.innerHTML = "";

        monthNames.forEach((name, index) => {
            const monthBox = document.createElement("div");
            monthBox.className = "yearly-month-box";
            monthBox.setAttribute("data-month", index + 1);
            monthBox.textContent = name;

            monthBox.addEventListener("click", () => {
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

                    if (selectedMonths.length > 0) {
                        const currentMonth = index + 1;
                        yearlyMonthSelect.value = currentMonth;
                        this.generateYearlyDayGrid(currentMonth);
                    } else {
                        this.deps.querySelector(".yearly-days").innerHTML = "";
                    }
                }
            });

            container.appendChild(monthBox);
        });
    }

    /**
     * Generate yearly day grid for a specific month
     */
    generateYearlyDayGrid(monthNumber) {
        const container = this.deps.querySelector(".yearly-days");
        if (!container) return;

        container.innerHTML = "";

        const daysInMonth = new Date(2025, monthNumber, 0).getDate();
        const selectedDays = this.state.selectedYearlyDays[monthNumber] || [];
        const yearlyApplyToAllCheckbox = this.deps.getElementById("yearly-apply-days-to-all");
        const applyToAll = yearlyApplyToAllCheckbox?.checked;
        const activeMonths = this.getSelectedYearlyMonths();

        // If "apply to all" is checked, use the shared day list
        const sharedDays = this.state.selectedYearlyDays["all"] || [];

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

            dayBox.addEventListener("click", () => {
                dayBox.classList.toggle("selected");
                const isNowSelected = dayBox.classList.contains("selected");

                if (applyToAll) {
                    // Update sharedDays
                    if (isNowSelected && !sharedDays.includes(i)) {
                        sharedDays.push(i);
                    } else if (!isNowSelected && sharedDays.includes(i)) {
                        const idx = sharedDays.indexOf(i);
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
                    if (isNowSelected && !current.includes(i)) {
                        current.push(i);
                    } else if (!isNowSelected && current.includes(i)) {
                        const idx = current.indexOf(i);
                        current.splice(idx, 1);
                    }
                    this.state.selectedYearlyDays[monthNumber] = current;
                }
            });

            container.appendChild(dayBox);
        }
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
        return Array.from(this.deps.querySelectorAll(".yearly-month-box.selected"))
                    .map(el => parseInt(el.dataset.month));
    }

    /**
     * Get selected monthly days
     */
    getSelectedMonthlyDays() {
        return Array.from(this.deps.querySelectorAll(".monthly-day-box.selected"))
                    .map(el => parseInt(el.dataset.day));
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

            input.addEventListener("change", () => {
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

                trash.addEventListener("click", () => {
                    wrapper.remove();
                    this.updateRecurCountVisibility();
                    this.updateRecurringSummary();
                });
                wrapper.appendChild(trash);
            }

            list.appendChild(wrapper);
            this.updateRecurringSummary();
        };

        checkbox.addEventListener("change", () => {
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

        addBtn.addEventListener("click", () => {
            createDateInput(false);
        });

        this.updateRecurringSummary();
    }

    /**
     * Get tomorrow's date
     */
    getTomorrow() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (isNaN(tomorrow.getTime()) || tomorrow.getFullYear() > 2100) {
                throw new Error("Invalid date generated");
            }

            return tomorrow;
        } catch (error) {
            console.warn("⚠️ Error generating tomorrow's date:", error);
            const fallback = new Date();
            fallback.setDate(fallback.getDate() + 1);
            return fallback;
        }
    }

    /**
     * Update recurring count visibility based on settings
     */
    updateRecurCountVisibility() {
        const isIndefinite = this.deps.getElementById("recur-indefinitely")?.checked;
        const isUsingSpecificDates = this.deps.getElementById("recur-specific-dates")?.checked;
        const countContainer = this.deps.getElementById("recur-count-container");

        if (!countContainer) return;

        // Only show if NOT using specific dates AND NOT recurring indefinitely
        const shouldShow = !isUsingSpecificDates && !isIndefinite;
        countContainer.classList.toggle("hidden", !shouldShow);
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
            applyBtn.addEventListener("click", () => this.handleApplySettings());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => this.handleCancelSettings());
        }
    }

    /**
     * Handle applying recurring settings to checked tasks
     */
    async handleApplySettings() {
        console.log('📝 Applying recurring settings (AppState-based)...');

        try {
            // ✅ Wait for core systems to be ready (AppState + data)
            await appInit.waitForCore();

            const state = this.deps.getAppState();
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

            // Batch all updates in one AppState operation
            if (window.AppState && window.AppState.update) {
                window.AppState.update(draft => {
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

                        let task = cycle.tasks.find(t => t.id === taskId);
                        if (!task) {
                            task = {
                                id: taskId,
                                text: taskEl.querySelector(".recurring-task-text")?.textContent || "Untitled Task",
                                recurring: true,
                                recurringSettings: structuredClone(settings),
                                schemaVersion: 2
                            };
                            cycle.tasks.push(task);
                        }

                        // Apply recurring settings to task
                        task.recurring = true;
                        task.schemaVersion = 2;
                        task.recurringSettings = structuredClone(settings);

                        // Update recurringTemplates
                        cycle.recurringTemplates[task.id] = {
                            id: task.id,
                            text: task.text,
                            dueDate: task.dueDate || null,
                            highPriority: task.highPriority || false,
                            remindersEnabled: task.remindersEnabled || false,
                            recurring: true,
                            recurringSettings: structuredClone(settings),
                            nextScheduledOccurrence: calculateNextOccurrence(settings, Date.now()),
                            schemaVersion: 2
                        };
                    });
                }, true); // ✅ Immediate save to prevent data loss on browser crash
            }

            // Update DOM after state changes
            if (window.syncRecurringStateToDOM) {
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

                    window.syncRecurringStateToDOM(taskEl, settings);
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
                    const state = this.deps.getAppState();
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
            box.addEventListener("click", () => {
                box.classList.toggle("selected");
            });
        });
    }

    /**
     * Setup additional event listeners for recurring panel
     */
    setupAdditionalListeners() {
        // Specific date time checkbox
        const specificDateTime = this.deps.getElementById("specific-date-specific-time");
        if (specificDateTime) {
            specificDateTime.addEventListener("change", (e) => {
                const timeContainer = this.deps.getElementById("specific-date-time-container");
                if (timeContainer) {
                    timeContainer.classList.toggle("hidden", !e.target.checked);
                }
                this.updateRecurringSummary();
            });
        }

        // Recur indefinitely checkbox
        const recurIndefinitely = this.deps.getElementById("recur-indefinitely");
        if (recurIndefinitely) {
            recurIndefinitely.addEventListener("change", (e) => {
                const countContainer = this.deps.getElementById("recur-count-container");
                if (countContainer) {
                    countContainer.classList.toggle("hidden", e.target.checked);
                }
                this.updateRecurCountVisibility();
                this.updateRecurringSummary();
            });
        }

        // Document click handler for hiding preview when clicking outside
        document.addEventListener("click", (e) => {
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
            await appInit.waitForCore();

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
            await appInit.waitForCore();

            const state = this.deps.getAppState();
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

            const templateTasks = Object.values(cycleData.recurringTemplates || {});
            console.log('📋 Template tasks:', templateTasks.map(t => ({ id: t.id, text: t.text })));
            
            const recurringTasks = templateTasks.map(template => {
                const existingTask = cycleData.tasks.find(t => t.id === template.id);
                return existingTask || template;
            });

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

        item.innerHTML = `
            <input type="checkbox"
                   class="recurring-check"
                   id="recurring-check-${task.id}"
                   name="recurring-check-${task.id}"
                   aria-label="Mark this task temporarily">
            <span class="recurring-task-text">${task.text}</span>
            <button title="Remove from Recurring" class="recurring-remove-btn">
              <i class='fas fa-trash recurring-trash-icon'></i>
            </button>
        `;

        // Setup checkbox
        const checkbox = item.querySelector(".recurring-check");
        checkbox.addEventListener("click", (e) => {
            e.stopPropagation();
            item.classList.toggle("checked");
        });
        checkbox.classList.add("hidden");

        // Setup remove button
        const removeBtn = item.querySelector("button");
        removeBtn.addEventListener("click", () => this.handleRemoveTask(task, item));

        // Setup row click for selection
        item.addEventListener("click", (e) => {
            if (e.target.closest(".recurring-remove-btn") || e.target.closest("input[type='checkbox']")) {
                return;
            }

            this.deps.querySelectorAll(".recurring-task-item").forEach(el => {
                el.classList.remove("selected");
            });
            item.classList.add("selected");

            this.state.selectedTaskId = task.id;
            
            // ✅ Get fresh data from AppState instead of using stale cycleData
            if (this.deps.isAppStateReady()) {
                const currentState = this.deps.getAppState();
                const activeCycleId = currentState.appState?.activeCycleId;
                const currentCycle = currentState.data?.cycles?.[activeCycleId];
                const fullTask = currentCycle?.tasks.find(t => t.id === task.id) || task;
                this.showTaskSummaryPreview(fullTask);
            } else {
                // Fallback to original behavior if AppState not ready
                const fullTask = cycleData.tasks.find(t => t.id === task.id) || task;
                this.showTaskSummaryPreview(fullTask);
            }
        });

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
                    if (!this.deps.isAppStateReady()) {
                        console.error('❌ AppState not ready for task removal');
                        this.deps.showNotification('App not ready, please try again', 'error');
                        return;
                    }

                    const state = this.deps.getAppState();
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
                    const updatedState = this.deps.getAppState();
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
            if (!this.deps.isAppStateReady()) {
                console.warn('⚠️ AppState not ready for showTaskSummaryPreview');
                return;
            }

            const state = this.deps.getAppState();
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

            // ✅ Debug: Check button state before updating preview
            const changeBtnBefore = this.deps.getElementById("change-recurring-settings");
            console.log('🔍 Button state before preview update:', {
                exists: !!changeBtnBefore,
                visible: changeBtnBefore ? !changeBtnBefore.classList.contains("hidden") : false,
                hasEventListener: changeBtnBefore ? changeBtnBefore.onclick !== null : false
            });

            if (!recurringSettings) {
                previewText.innerHTML = `
                    <strong>${task.text}</strong><br>
                    <em>No recurring settings configured</em>
                `;
                return;
            }

            const summaryText = this.deps.buildRecurringSummary(recurringSettings);

            // ✅ Get next occurrence text
            const nextOccurrenceText = template?.nextScheduledOccurrence
                ? formatNextOccurrence(template.nextScheduledOccurrence)
                : null;

            previewText.innerHTML = `
                <strong>${task.text}</strong><br>
                <span class="recurring-summary-text">${summaryText}</span>
                ${nextOccurrenceText ? `<br><span class="next-occurrence-text">${nextOccurrenceText}</span>` : ''}
            `;

            // ✅ Ensure the button is visible after updating preview
            const changeBtn = this.deps.getElementById("change-recurring-settings");
            if (changeBtn) {
                changeBtn.style.display = ""; // Remove any display: none
                changeBtn.classList.remove("hidden"); // Remove hidden class if present
                console.log('✅ Change recurring settings button made visible');
            } else {
                console.warn('⚠️ Change recurring settings button not found in DOM');
            }

            // ✅ Debug: Check button state after updating preview
            console.log('🔍 Button state after preview update:', {
                exists: !!changeBtn,
                visible: changeBtn ? !changeBtn.classList.contains("hidden") : false,
                parentVisible: summaryContainer ? !summaryContainer.classList.contains("hidden") : false
            });

            console.log('✅ Task summary preview displayed');

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
        container.className = 'recurring-summary-preview';

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
        try {
            const frequency = this.deps.getElementById("recur-frequency")?.value || "daily";
            const indefinitely = this.deps.getElementById("recur-indefinitely")?.checked ?? true;
            const count = indefinitely ? null : parseInt(this.deps.getElementById("recur-count-input")?.value) || 1;

            const settings = {
                frequency,
                indefinitely,
                count,
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

            // ✅ Specific Dates Mode
            if (this.deps.getElementById("recur-specific-dates")?.checked) {
                const dateInputs = this.deps.querySelectorAll("#specific-date-list input[type='date']");
                settings.specificDates.enabled = true;
                settings.specificDates.dates = Array.from(dateInputs).map(input => input.value).filter(Boolean);

                if (this.deps.getElementById("specific-date-specific-time")?.checked) {
                    settings.useSpecificTime = true;
                    settings.time = {
                        hour: parseInt(this.deps.getElementById("specific-date-hour")?.value) || 0,
                        minute: parseInt(this.deps.getElementById("specific-date-minute")?.value) || 0,
                        meridiem: this.deps.getElementById("specific-date-meridiem")?.value,
                        military: this.deps.getElementById("specific-date-military")?.checked
                    };
                }
            } else {
                // ✅ Time block for non-specific-dates
                const timeId = frequency;
                const timeEnabled = this.deps.getElementById(`${timeId}-specific-time`)?.checked;

                // ✅ Time block for non-specific-dates — EXCLUDE hourly!
                if (frequency !== "hourly" && timeEnabled) {
                    settings.useSpecificTime = true;
                    settings.time = {
                        hour: parseInt(this.deps.getElementById(`${timeId}-hour`)?.value) || 0,
                        minute: parseInt(this.deps.getElementById(`${timeId}-minute`)?.value) || 0,
                        meridiem: this.deps.getElementById(`${timeId}-meridiem`)?.value,
                        military: this.deps.getElementById(`${timeId}-military`)?.checked
                    };
                }

                // ✅ Hourly Specific Minute
                if (frequency === "hourly") {
                    const useSpecificMinute = this.deps.getElementById("hourly-specific-time")?.checked;
                    const minuteEl = this.deps.getElementById("hourly-minute");

                    settings.hourly = {
                        useSpecificMinute: !!useSpecificMinute,
                        minute: useSpecificMinute && minuteEl ? parseInt(minuteEl.value) || 0 : 0
                    };
                }

                // ✅ Weekly & Biweekly
                if (frequency === "weekly" || frequency === "biweekly") {
                    const selector = `.${frequency}-day-box.selected`;
                    settings[frequency] = {
                        useSpecificDays: this.deps.getElementById(`${frequency}-specific-days`)?.checked,
                        days: Array.from(this.deps.querySelectorAll(selector)).map(el => el.dataset.day)
                    };
                }

                // ✅ Monthly
                if (frequency === "monthly") {
                    settings.monthly = {
                        useSpecificDays: this.deps.getElementById("monthly-specific-days")?.checked,
                        days: Array.from(this.deps.querySelectorAll(".monthly-day-box.selected")).map(el => parseInt(el.dataset.day))
                    };
                }

                // ✅ Yearly
                if (frequency === "yearly") {
                    const applyAll = this.deps.getElementById("yearly-apply-days-to-all")?.checked;
                    const useMonths = this.deps.getElementById("yearly-specific-months")?.checked;
                    const useDays = this.deps.getElementById("yearly-specific-days")?.checked;

                    settings.yearly = {
                        useSpecificMonths: useMonths,
                        months: this.getSelectedYearlyMonths(),
                        useSpecificDays: useDays,
                        daysByMonth: applyAll ? { all: this.state.selectedYearlyDays["all"] || [] } : { ...this.state.selectedYearlyDays },
                        applyDaysToAll: applyAll
                    };
                }
            }

            return this.deps.normalizeRecurringSettings(settings);

        } catch (error) {
            console.error('❌ Error building settings from panel:', error);
            return { frequency: 'daily', indefinitely: true };
        }
    }

    // ============================================
    // FORM POPULATION
    // ============================================

    /**
     * Populate recurring form with settings
     * @param {Object} settings - Recurring settings to populate
     */
    populateRecurringFormWithSettings(settings) {
        console.log('📝 Populating recurring form with settings:', settings);

        try {
            // Frequency dropdown
            const frequencySelect = this.deps.getElementById('recur-frequency');
            if (frequencySelect && settings.frequency) {
                frequencySelect.value = settings.frequency;
                frequencySelect.dispatchEvent(new Event('change'));
            }

            // Indefinite checkbox
            const indefiniteCheckbox = this.deps.getElementById('recur-indefinitely');
            if (indefiniteCheckbox) {
                indefiniteCheckbox.checked = settings.indefinitely !== false;
            }

            // Repeat count
            if (settings.indefinitely === false && settings.count) {
                const countInput = this.deps.getElementById('recur-count-input');
                if (countInput) {
                    countInput.value = settings.count;
                }
            }

            // Update the summary display
            this.updateRecurringSummary();

            console.log('✅ Form populated successfully');

        } catch (error) {
            console.error('❌ Error populating form with settings:', error);
        }
    }

    /**
     * Clear/reset the recurring form
     */
    clearRecurringForm() {
        console.log('🧹 Clearing recurring form');

        try {
            // Reset frequency to default
            const frequencySelect = this.deps.getElementById('recur-frequency');
            if (frequencySelect) {
                frequencySelect.value = 'daily';
                frequencySelect.dispatchEvent(new Event('change'));
            }

            // Reset indefinite checkbox
            const indefiniteCheckbox = this.deps.getElementById('recur-indefinitely');
            if (indefiniteCheckbox) {
                indefiniteCheckbox.checked = true;
            }

            // Clear repeat count
            const countInput = this.deps.getElementById('recur-count-input');
            if (countInput) {
                countInput.value = '';
            }

            console.log('✅ Form cleared successfully');

        } catch (error) {
            console.error('❌ Error clearing form:', error);
        }
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
                if (!this.deps.isAppStateReady()) {
                    console.warn('⚠️ AppState not ready for button visibility check');
                    panelButton.classList.add("hidden"); // Hide by default
                    return;
                }

                const state = this.deps.getAppState();
                const activeCycleId = state.appState?.activeCycleId;
                const currentCycle = state.data?.cycles?.[activeCycleId];

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
            if (!this.deps.isAppStateReady || !this.deps.isAppStateReady()) {
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

            // ✅ Trigger button refresh to show/hide recurring buttons after small delay
            // This ensures AppState changes have fully propagated
            setTimeout(() => {
                if (typeof window.refreshTaskButtonsForModeChange === 'function') {
                    console.log('🔄 Refreshing task buttons for always-show-recurring change...');
                    window.refreshTaskButtonsForModeChange();
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
            if (!this.deps.isAppStateReady || !this.deps.isAppStateReady()) {
                console.warn('⚠️ AppState not ready for loading always show recurring setting');
                return;
            }

            const state = this.deps.getAppState();
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
            panel.addEventListener("change", () => this.updateRecurringSummary());
            panel.addEventListener("click", () => this.updateRecurringSummary());

            console.log('✅ Recurring summary listeners attached successfully');

        } catch (error) {
            console.error('❌ Error attaching summary listeners:', error);
        }
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
                if (this.deps.isAppStateReady()) {
                    const state = this.deps.getAppState();
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

/**
 * Build recurring summary text from settings
 * Standalone function for use outside the class
 * @param {Object} settings - Recurring settings
 * @returns {string} Summary text
 */
export function buildRecurringSummaryFromSettings(settings = {}) {
    const freq = settings.frequency || "daily";
    const indefinitely = settings.indefinitely ?? true;
    const count = settings.count;

    // Helper function for parsing dates
    const parseDateAsLocal = (dateStr) => {
        try {
            const [year, month, day] = dateStr.split("-").map(Number);
            return new Date(year, month - 1, day);
        } catch (error) {
            return new Date();
        }
    };

    // === ✅ SPECIFIC DATES OVERRIDE ===
    if (settings.specificDates?.enabled && settings.specificDates.dates?.length) {
        const formattedDates = settings.specificDates.dates.map(dateStr => {
            const date = parseDateAsLocal(dateStr);
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                weekday: "short"
            });
        });

        let summary = `📅 Specific dates: ${formattedDates.join(", ")}`;

        // Optionally show time for specific dates
        if (settings.time) {
            const { hour, minute, meridiem, military } = settings.time;
            const formattedTime = military
                ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
                : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
            summary += ` ⏰ at ${formattedTime}`;
        }

        return summary;
    }

    // === 🔁 Normal Recurrence Fallback ===
    let summaryText = `⏱ Repeats ${freq}`;
    if (!indefinitely && count) {
        summaryText += ` for ${count} time${count !== 1 ? "s" : ""}`;
    } else {
        summaryText += " indefinitely";
    }

    // === TIME HANDLING ===
    if (settings.time && (settings.useSpecificTime ?? true)) {
        const { hour, minute, meridiem, military } = settings.time;
        const formatted = military
            ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
            : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
        summaryText += ` at ${formatted}`;
    }

    // === HOURLY ===
    if (freq === "hourly" && settings.hourly?.useSpecificMinute) {
        summaryText += ` every hour at :${settings.hourly.minute.toString().padStart(2, "0")}`;
    }

    // === WEEKLY & BIWEEKLY ===
    if ((freq === "weekly" || freq === "biweekly") && settings[freq]?.days?.length) {
        summaryText += ` on ${settings[freq].days.join(", ")}`;
    }

    // === MONTHLY ===
    if (freq === "monthly" && settings.monthly?.days?.length) {
        summaryText += ` on day${settings.monthly.days.length > 1 ? "s" : ""} ${settings.monthly.days.join(", ")}`;
    }

    // === YEARLY ===
    if (freq === "yearly") {
        const months = settings.yearly?.months || [];
        const daysByMonth = settings.yearly?.daysByMonth || {};

        if (months.length) {
            const monthNames = months.map(m => new Date(0, m - 1).toLocaleString("default", { month: "short" }));
            summaryText += ` in ${monthNames.join(", ")}`;
        }

        if (settings.yearly?.useSpecificDays) {
            if (settings.yearly.applyDaysToAll && daysByMonth.all?.length) {
                summaryText += ` on day${daysByMonth.all.length > 1 ? "s" : ""} ${daysByMonth.all.join(", ")}`;
            }
        }
    }

    return summaryText;
}

// ============================================
// EXPORTS
// ============================================

console.log('🛡️ RecurringPanel module loaded (Resilient Constructor Pattern)');
