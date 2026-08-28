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
import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { ICONS } from '../utils/icons.js';
import { getLabel } from '../labels/labelResolver.js';

// Add-recurring-task flow (splits-plan Priority 4). Static import, matching the
// other five sub-modules in this family; they are plain functions with no DI, so
// there is nothing to wire at boot. `this.state` is handed over by REFERENCE —
// the flow writes selectedTaskId / preservedCheckedIds back onto the parent.
import {
    setupAddTaskSection as _setupAddTaskSection,
    updateConfirmButtonVisibility as _updateConfirmButtonVisibility,
    populateAvailableTasks as _populateAvailableTasks,
    handleConfirmAddRecurring as _handleConfirmAddRecurring
} from './recurringPanelAddTask.js';
import { animateDialogClose } from '../utils/dialogClose.js';
// Boot-time helpers — single source of truth for button-visibility + info-link so
// recurringIntegration can run them at boot WITHOUT loading this 2k-line panel.
import {
    updateRecurringButtonVisibility as bootUpdateButtonVisibility,
    updateRecurringInfoLink as bootUpdateInfoLink
} from './recurringBoot.js';

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

    safeAddEventListener: required(),

    // Optional — genuinely nullable, code checks before use
    appInit: optional(null),
    loadData: optional(null),
    escapeHtml: optional(null),
    syncRecurringStateToDOM: optional(null),
    refreshTaskButtonsForModeChange: optional(null),
    refreshUIFromState: optional(null),
    activateTaskRecurringState: optional(null),
    deactivateTaskRecurringState: optional(null),
    getModal: optional(null),
    showRecurringListTourNotification: optional(null),
    showRecurringSettingsTourNotification: optional(null)
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
    constructor() {

        // Internal state
        this.state = {
            isInitialized: false,
            panelOpen: false,
            panelMode: 'browsing', // 'browsing' | 'previewing' | 'editing'
            selectedTaskId: null,
            selectedYearlyDays: {} // key = month number, value = array of selected days
        };

        // ✅ MEMORY LEAK FIX: Track event delegation initialization
        this._eventDelegationInitialized = false;

    }

    get deps() {
        return di.resolve();
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
            getSelectedYearlyMonths: () => this.getSelectedYearlyMonths(),
            setPanelMode: (mode) => this.setPanelMode(mode),
            getPanelMode: () => this.state.panelMode
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

        // Inject form actions for callback pattern
        if (_formModule?.setFormActions) {
            _formModule.setFormActions({
                updateRecurringSummary: () => this.updateRecurringSummary(),
                normalizeRecurringSettings: (settings) => this.deps.normalizeRecurringSettings(settings) || settings
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

            // NOTE: the open-panel button is wired at BOOT by
            // recurringBoot.wireRecurringOpenTriggers() — it must work before this panel
            // lazily loads, so it is intentionally NOT wired here (would double-fire).
            // openBtn is still required above as a DOM-readiness guard.

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
                overlay._previousFocus?.focus({ focusVisible: false });
            });

            // Setup change recurring settings button
            const changeSettingsBtn = this.deps.getElementById(DOM_IDS.CHANGE_RECURRING_SETTINGS);
            if (changeSettingsBtn) {
                this.deps.safeAddEventListener(changeSettingsBtn, "click", () => {
                    this.openSettingsFormForSelectedTask();
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

            // Time-of-day uses native <input type="time"> per section, so no
            // 12/24h conversion, meridiem toggle, or hour/minute wrap-around is
            // needed. Hourly still uses a numeric minute input — keep its wrap.
            this.setupHourlyMinuteWrapping();

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
                    this.updateYearlyDaysForMonthLabel(selectedMonth);
                });
                this.generateYearlyDayGrid(1);
                this.updateYearlyDaysForMonthLabel(1);
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
                    yearlyDayContainer.classList.toggle(DOM_CLASSES.HIDDEN, !yearlySpecificDaysCheckbox.checked || !hasMonthSelected);
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

            // Keyboard: Enter toggles checkboxes, Arrow Up/Down navigates
            this.deps.safeAddEventListener(overlay, 'keydown', (e) => {
                const active = this.deps.getActiveElement?.() || document.activeElement;

                // Enter toggles checkboxes (native checkboxes only respond to Space)
                if (e.key === 'Enter' && active?.type === 'checkbox' && !active.disabled) {
                    e.preventDefault();
                    active.checked = !active.checked;
                    active.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }

                // Arrow Up/Down navigates between visible interactive elements
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                // Skip if focused on a text/number input (arrows adjust value)
                if (active?.tagName === 'INPUT' && (active.type === 'text' || active.type === 'number')) return;
                e.preventDefault();
                const focusable = [...overlay.querySelectorAll(
                    DOM_SELECTORS.FOCUSABLE_ELEMENTS
                )].filter(el => el.offsetParent !== null && !el.disabled
                    && getComputedStyle(el).display !== 'none');
                if (focusable.length === 0) return;
                const idx = focusable.indexOf(active);
                const next = e.key === 'ArrowDown'
                    ? (idx + 1) % focusable.length
                    : (idx - 1 + focusable.length) % focusable.length;
                focusable[next].focus();
            });

            this.state.isInitialized = true;

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
        const result = _setupAdvancedToggle(this.deps);
        if (result?.resetAdvanced) {
            this._resetAdvanced = result.resetAdvanced;
        }
    }

    /**
     * Setup wrap-around for hourly-only minute input
     */
    setupHourlyMinuteWrapping() {
        _setupHourlyMinuteWrapping?.(this.deps, () => this.updateRecurringSummary());
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
     * Update the "Select days for [Month]:" label above the day grid
     * @param {number} monthNumber - 1-based month number
     */
    updateYearlyDaysForMonthLabel(monthNumber) {
        const label = this.deps.getElementById(DOM_IDS.YEARLY_DAYS_FOR_MONTH_LABEL);
        if (!label) return;

        const monthName = new Date(0, monthNumber - 1).toLocaleString('default', { month: 'long' });
        label.textContent = getLabel('recurring.selectDaysForMonth', { vars: { month: monthName } });
    }

    /**
     * Handle yearly "apply to all months" checkbox change
     */
    handleYearlyApplyToAllChange() {
        const checkbox = this.deps.getElementById(DOM_IDS.YEARLY_APPLY_DAYS_TO_ALL);
        const dropdown = this.deps.getElementById(DOM_IDS.YEARLY_MONTH_SELECT);
        const daysLabel = this.deps.getElementById(DOM_IDS.YEARLY_DAYS_FOR_MONTH_LABEL);
        const selectedMonths = this.getSelectedYearlyMonths();

        if (!checkbox || !dropdown) return;

        if (checkbox.checked) {
            dropdown.classList.add(DOM_CLASSES.HIDDEN);
            if (daysLabel) {
                daysLabel.textContent = getLabel('recurring.selectDaysForAllMonths');
            }
            if (selectedMonths.length > 0) {
                this.generateYearlyDayGrid(selectedMonths[0]); // Use any selected month for grid
            }
        } else {
            dropdown.classList.remove(DOM_CLASSES.HIDDEN);
            const selectedMonth = parseInt(dropdown.value);
            this.generateYearlyDayGrid(selectedMonth);
            this.updateYearlyDaysForMonthLabel(selectedMonth);
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
     * Setup the specific-dates panel
     * Delegates to recurringPanelSetup module
     */
    setupSpecificDatesPanel() {
        _setupSpecificDatesPanel(this.deps, {
            getTomorrow: () => this.getTomorrow(),
            updateRecurringSummary: () => this.updateRecurringSummary(),
            updateRecurCountVisibility: () => this.updateRecurCountVisibility()
        });
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
        // Deselect all tasks and uncheck checkboxes (data reset)
        this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).forEach(el => {
            el.classList.remove(DOM_CLASSES.SELECTED, DOM_CLASSES.CHECKED);
            el.setAttribute('aria-selected', 'false');
            const checkbox = el.querySelector(DOM_SELECTORS.RECURRING_CHECK);
            if (checkbox) checkbox.checked = false;
        });

        this.state.selectedTaskId = null;
        this.setPanelMode('browsing');
    }

    /**
     * Setup biweekly Week 1 / Week 2 day pickers
     * Delegates to recurringPanelSetup module
     */
    setupBiweeklyDayToggle() {
        _setupBiweeklyDayToggle(this.deps);
    }

    /**
     * Setup duration options (indefinitely checkbox, count/until radio buttons)
     * Delegates to recurringPanelSetup module
     */
    setupDurationRadioButtons() {
        _setupDurationRadioButtons(this.deps);
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
            updateRecurCountVisibility: () => this.updateRecurCountVisibility(),
            deselectAndBrowse: () => {
                this.handleCancelSettings();
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

        try {
            // ✅ Wait for core systems to be ready (AppState + data)
            await this.deps.appInit?.waitForCore();

            // Update panel with current data
            await this.updateRecurringPanel();

            // Show overlay
            const overlay = this.deps.getModal('recurringOverlay');
            if (overlay) {
                overlay._previousFocus = this.deps.getActiveElement?.() || document.activeElement;
                if (!overlay.open) overlay.showModal();
            }

            // Always collapse advanced settings when panel opens
            this._resetAdvanced?.();

            this.state.panelOpen = true;
            this.setPanelMode('browsing');

            // Show recurring list tour prompt after modal is open
            this.deps.showRecurringListTourNotification?.();

        } catch (error) {
            console.error('❌ Error opening recurring panel:', error);
            this.deps.showNotification(getLabel('notify.panelOpenFailed'), 'error');
        }
    }

    /**
     * Close the recurring panel
     */
    async closePanel() {

        try {
            const overlay = this.deps.getModal('recurringOverlay');
            if (overlay) {
                await animateDialogClose(overlay);
                overlay._previousFocus?.focus({ focusVisible: false });
            }

            // Reset specific-dates checkbox so _resetAdvanced() on reopen doesn't hide its label while it's checked
            const specificDatesCheckbox = this.deps.getElementById(DOM_IDS.RECUR_SPECIFIC_DATES);
            if (specificDatesCheckbox?.checked) {
                specificDatesCheckbox.checked = false;
                // Trigger the change handler to restore frequency dropdown, time picker, etc.
                specificDatesCheckbox.dispatchEvent(new Event('change'));
            }

            this.state.selectedTaskId = null;
            this.state.panelOpen = false;
            this.setPanelMode('browsing');

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

        try {
            const recurringList = this.deps.getElementById(DOM_IDS.RECURRING_TASK_LIST);
            if (!recurringList) {
                console.warn('⚠️ Recurring task list element not found');
                return;
            }

            // ✅ Wait for core systems to be ready (AppState + data)
            await this.deps.appInit?.waitForCore();

            const state = this.deps.AppState.get();
            const activeCycleId = state?.appState?.activeCycleId;

            if (!activeCycleId) {
                console.warn('⚠️ No active cycle ID found for recurring panel');
                return;
            }

            const cycles = state.data?.cycles || {};
            const cycleData = currentCycleData || cycles[activeCycleId];

            if (!cycleData) {
                console.warn('⚠️ No cycle data found for recurring panel');
                return;
            }

            // Use templates directly - they are the source of truth, independent of tasks array
            const recurringTasks = Object.values(cycleData.recurringTemplates || {});

            // Clear existing list
            // Remember previously selected task AND checked tasks BEFORE clearing DOM
            const previouslySelectedId = this.state.selectedTaskId;
            const previouslyCheckedIds = Array.from(
                this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM_CHECKED)
            ).map(el => el.dataset.taskId);

            // Merge in preserved checked IDs (saved before async operations that rebuild DOM)
            if (this.state.preservedCheckedIds?.length) {
                this.state.preservedCheckedIds.forEach(id => {
                    if (!previouslyCheckedIds.includes(id)) {
                        previouslyCheckedIds.push(id);
                    }
                });
                this.state.preservedCheckedIds = null;
            }

            // Now clear the DOM
            recurringList.innerHTML = "";

            // Handle empty state
            const emptyState = this.deps.getElementById(DOM_IDS.RECURRING_EMPTY_STATE);
            const panelHint = recurringList.parentElement?.querySelector(DOM_SELECTORS.RECURRING_PANEL_HINT);

            if (recurringTasks.length === 0) {
                if (emptyState) emptyState.classList.remove(DOM_CLASSES.HIDDEN);
                if (panelHint) panelHint.classList.add(DOM_CLASSES.HIDDEN);

                // ✅ Hide the preview when no tasks
                const summaryContainer = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
                if (summaryContainer) {
                    summaryContainer.classList.add(DOM_CLASSES.HIDDEN);
                }
            } else {
                if (emptyState) emptyState.classList.add(DOM_CLASSES.HIDDEN);
                if (panelHint) panelHint.classList.remove(DOM_CLASSES.HIDDEN);

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
                        item.classList.add(DOM_CLASSES.SELECTED);
                        this.showTaskSummaryPreview(task);
                    }

                    // ✅ Restore checked state if this task was previously checked
                    if (previouslyCheckedIds.includes(task.id)) {
                        item.classList.add(DOM_CLASSES.CHECKED);
                        const checkbox = item.querySelector(DOM_SELECTORS.RECURRING_CHECK);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    }
                });
            }

            this.updateRecurringSummary();

            // Reapply current panel mode after re-render
            // (new DOM elements have checkboxes hidden by default)
            this.applyPanelMode();

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
        item.setAttribute("role", "option");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-selected", "false");

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
        removeBtn.setAttribute("aria-label", getLabel('recurring.removeFromRecurring'));
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
                    if (!this.deps.AppState.isReady?.()) {
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

                    this.deps.showNotification(`↩️ ${getLabel('notify.recurringTurnedOff')}`, "info", UI_TIMEOUTS.NOTIFICATION_SLOW);

                    // Remove recurring visual state
                    const matchingTaskItem = this.deps.querySelector(DATA_SELECTORS.taskById(task.id));
                    if (matchingTaskItem) {
                        // Remove active state from recurring button
                        const recurringBtn = matchingTaskItem.querySelector(DOM_SELECTORS.RECURRING_BTN);
                        if (recurringBtn) {
                            recurringBtn.classList.remove(DOM_CLASSES.ACTIVE);
                            recurringBtn.setAttribute("aria-pressed", "false");
                            recurringBtn.disabled = false;
                        }
                        // Remove the recurring indicator icon from task label
                        const recurringIndicator = matchingTaskItem.querySelector(DOM_SELECTORS.RECURRING_INDICATOR);
                        if (recurringIndicator) {
                            recurringIndicator.remove();
                        }
                        matchingTaskItem.classList.remove(DOM_CLASSES.RECURRING);
                        matchingTaskItem.removeAttribute(DATA_SELECTORS.ATTR_RECURRING_SETTINGS);

                        // Restore delete-when-complete state based on cycle mode
                        const updatedState = this.deps.AppState.get();
                        const freshCycle = updatedState.data?.cycles?.[activeCycleId];
                        const isToDoMode = freshCycle?.deleteCheckedTasks === true;
                        const defaultDeleteState = isToDoMode; // todo=true, cycle=false

                        // Update delete-when-complete button
                        const deleteBtn = matchingTaskItem.querySelector(DOM_SELECTORS.DELETE_WHEN_COMPLETE_BTN);
                        if (deleteBtn) {
                            deleteBtn.classList.toggle(DOM_CLASSES.ACTIVE, defaultDeleteState);
                            deleteBtn.classList.toggle(DOM_CLASSES.DELETE_WHEN_COMPLETE_ACTIVE, defaultDeleteState);
                            deleteBtn.setAttribute('aria-pressed', defaultDeleteState.toString());
                        }

                        // Update data attribute and visual indicators
                        matchingTaskItem.dataset.deleteWhenComplete = defaultDeleteState.toString();
                        if (isToDoMode) {
                            matchingTaskItem.classList.remove(DOM_CLASSES.SHOW_DELETE_INDICATOR);
                            matchingTaskItem.classList.toggle(DOM_CLASSES.KEPT_TASK, !defaultDeleteState);
                        } else {
                            matchingTaskItem.classList.toggle(DOM_CLASSES.SHOW_DELETE_INDICATOR, defaultDeleteState);
                            matchingTaskItem.classList.remove(DOM_CLASSES.KEPT_TASK);
                        }
                    }

                    item.remove();

                    // Clear selected state if the removed task was selected
                    if (this.state.selectedTaskId === task.id) {
                        this.state.selectedTaskId = null;
                        this.setPanelMode('browsing');
                    } else {
                        this.applyPanelMode();
                    }
                    this.updateRecurringPanelButtonVisibility();
                    this.updateRecurringInfoLink();

                    // ✅ Check remaining templates via AppState
                    const updatedState = this.deps.AppState.get();
                    const updatedCycle = updatedState.data?.cycles?.[activeCycleId];
                    const remaining = Object.values(updatedCycle?.recurringTemplates || {});
                    if (remaining.length === 0) {
                        const overlay = this.deps.getModal('recurringOverlay');
                        if (overlay) {
                            animateDialogClose(overlay);
                            overlay._previousFocus?.focus({ focusVisible: false });
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
     * Set the panel mode and apply corresponding visibility
     * @param {'browsing'|'previewing'|'editing'} mode
     */
    setPanelMode(mode) {
        this.state.panelMode = mode;
        this.applyPanelMode();

        // Show recurring settings tour when entering editing mode for the first time
        if (mode === 'editing') {
            this.deps.showRecurringSettingsTourNotification?.();
        }
    }

    /**
     * Apply visibility rules based on the current panel mode.
     *
     * BROWSING:   No task selected. Settings panel hidden, checkboxes hidden,
     *             change buttons hidden, summary preview hidden.
     * PREVIEWING: Task selected but not editing. Settings panel hidden,
     *             checkboxes hidden, change buttons visible, summary preview visible.
     * EDITING:    Task selected and editing settings. Settings panel visible,
     *             checkboxes visible, change buttons hidden, toggle visible (if >1 task).
     */
    applyPanelMode() {
        try {
            const mode = this.state.panelMode;
            const isEditing = mode === 'editing';
            const isBrowsing = mode === 'browsing';

            const settingsPanel = this.deps.getElementById(DOM_IDS.RECURRING_SETTINGS_PANEL);
            const checkboxes = this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_CHECK);
            const changeBtns = this.deps.querySelectorAll(DOM_SELECTORS.CHANGE_RECURRING_BTN);
            const toggleContainer = this.deps.getElementById(DOM_IDS.RECURRING_TOGGLE_ACTIONS);
            const toggleBtn = this.deps.getElementById(DOM_IDS.TOGGLE_CHECK_ALL);
            const taskCount = this.deps.querySelectorAll(DOM_SELECTORS.RECURRING_TASK_ITEM).length;

            // Two-column layout: active on desktop when editing
            const panel = this.deps.getElementById(DOM_IDS.RECURRING_PANEL);
            if (panel) {
                panel.classList.toggle(DOM_CLASSES.TWO_COL_ACTIVE, isEditing);
            }

            // Settings panel + title: only visible in EDITING
            if (settingsPanel) {
                settingsPanel.classList.toggle(DOM_CLASSES.HIDDEN, !isEditing);
                const settingsTitle = settingsPanel.previousElementSibling;
                if (settingsTitle?.classList.contains(DOM_CLASSES.RECURRING_SETTINGS_TITLE)) {
                    settingsTitle.classList.toggle(DOM_CLASSES.HIDDEN, !isEditing);
                }
            }

            // Checkboxes: only visible in EDITING
            checkboxes.forEach(box => {
                box.classList.toggle(DOM_CLASSES.HIDDEN, !isEditing);
            });

            // Per-item change buttons: only visible in PREVIEWING
            changeBtns.forEach(btn => {
                btn.classList.toggle(DOM_CLASSES.HIDDEN, mode !== 'previewing');
            });

            // Toggle container (Check All / Uncheck All): only in EDITING with >1 task
            const shouldShowToggle = isEditing && taskCount > 1;
            if (toggleContainer) {
                toggleContainer.classList.toggle(DOM_CLASSES.HIDDEN, !shouldShowToggle);
            }

            // Update toggle button label
            if (toggleBtn && shouldShowToggle) {
                const anyUnchecked = Array.from(checkboxes).some(
                    cb => !cb.checked && !cb.classList.contains(DOM_CLASSES.HIDDEN)
                );
                toggleBtn.textContent = anyUnchecked
                    ? getLabel('recurring.checkAll')
                    : getLabel('recurring.uncheckAll');
            }

            // Summary preview: hidden in BROWSING, visible in PREVIEWING/EDITING
            const summaryContainer = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY_PREVIEW);
            if (summaryContainer) {
                summaryContainer.classList.toggle(DOM_CLASSES.HIDDEN, isBrowsing);
            }

            this.updateRecurringSummary();

        } catch (error) {
            console.error('❌ Error applying panel mode:', error);
        }
    }

    /**
     * @deprecated Use setPanelMode() or applyPanelMode() instead.
     * Kept as alias for backward safety during migration.
     */
    updateRecurringSettingsVisibility() {
        this.applyPanelMode();
    }

    // ============================================
    // TASK SUMMARY PREVIEW
    // ============================================

    /**
     * Show task summary preview in panel
     * @param {Object} task - The task to preview
     */
    showTaskSummaryPreview(task) {

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
            summaryContainer.classList.remove(DOM_CLASSES.HIDDEN);

            // Get recurring settings
            if (!this.deps.AppState.isReady?.()) {
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

            // Change button visibility is managed by applyPanelMode() —
            // no manual toggle needed here.

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
        container.id = DOM_IDS.RECURRING_SUMMARY_PREVIEW;
        container.className = 'recurring-summary-preview hidden';

        // Create inner structure
        const summaryBox = document.createElement('div');
        summaryBox.className = 'summary-box';

        const previewText = document.createElement('p');
        previewText.id = DOM_IDS.RECURRING_PREVIEW_TEXT;

        const changeBtn = document.createElement('button');
        changeBtn.id = DOM_IDS.CHANGE_RECURRING_SETTINGS;
        changeBtn.className = 'change-recurring-btn';
        changeBtn.textContent = getLabel('recurring.changeSettings');

        // Attach click listener to button (guard for tests)
        if (this.deps.safeAddEventListener) {
            this.deps.safeAddEventListener(changeBtn, 'click', () => {
                this.openSettingsFormForSelectedTask();
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

        try {
            const summaryEl = this.deps.getElementById(DOM_IDS.RECURRING_SUMMARY);
            if (!summaryEl) {
                console.warn('⚠️ Recurring summary element not found');
                return;
            }

            // Build settings from the panel input
            const settings = this.buildRecurringSettingsFromPanel();

            // (A defaultRecurTime fallback was written here until v2.358 —
            // retired: nothing ever read the field, including the summary builder.)

            // Generate summary text using the shared utility
            const summaryText = this.deps.buildRecurringSummary(settings);

            // Apply to DOM
            summaryEl.textContent = summaryText;
            summaryEl.classList.remove(DOM_CLASSES.HIDDEN);

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
        // Delegate to the boot helper (single source of truth — runs at boot without the panel)
        bootUpdateButtonVisibility(this.deps);
    }

    /**
     * Update the recurring info link below the task list.
     * Shows recurring template count and links to the recurring panel.
     * Also enhances the empty state hint when task list is empty.
     */
    updateRecurringInfoLink() {
        // Delegate to the boot helper (single source of truth). Pass openPanel so the
        // info link's click/keydown handlers route through the panel.
        bootUpdateInfoLink(this.deps, { openPanel: () => this.openPanel() });
    }

    // ============================================
    // ADD TASK SECTION
    // ============================================

    /**
     * Wire the add-recurring-task section.
     * Delegates to recurringPanelAddTask module (Priority 4).
     */
    setupAddTaskSection() {
        return _setupAddTaskSection(this.deps, this.state, this._addTaskCallbacks());
    }

    /**
     * Show/hide the confirm button and label it with the selected count.
     * Delegates to recurringPanelAddTask module (Priority 4).
     */
    updateConfirmButtonVisibility() {
        return _updateConfirmButtonVisibility(this.deps, this.state, this._addTaskCallbacks());
    }

    /**
     * Populate the available (non-recurring) tasks list.
     * Delegates to recurringPanelAddTask module (Priority 4).
     */
    populateAvailableTasks() {
        return _populateAvailableTasks(this.deps, this.state, this._addTaskCallbacks());
    }

    /**
     * Commit the selected tasks as recurring.
     * Delegates to recurringPanelAddTask module (Priority 4).
     */
    async handleConfirmAddRecurring() {
        return _handleConfirmAddRecurring(this.deps, this.state, this._addTaskCallbacks());
    }

    /**
     * The two parent operations the add-task flow triggers. Built fresh per call
     * so the arrows always close over the CURRENT instance methods — binding once
     * in the constructor would freeze them past any later reassignment (the tests
     * stub updateRecurringPanel exactly that way).
     */
    _addTaskCallbacks() {
        return {
            setPanelMode: (mode) => this.setPanelMode(mode),
            updateRecurringPanel: () => this.updateRecurringPanel()
        };
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    /**
     * Re-render the summary on any change/click inside the settings panel
     * Delegates to recurringPanelSetup module
     */
    attachRecurringSummaryListeners() {
        _attachRecurringSummaryListeners(this.deps, {
            updateRecurringSummary: () => this.updateRecurringSummary()
        });
    }

    /**
     * Wire delegated click listener for .open-recurring-settings buttons
     * Moved from orchestrator.js for proper module ownership
     */
    wireRecurringSettingsClickListener() {
        if (!this.deps.safeAddEventListener) return; // Guard: dependency not injected (e.g., in tests)
        this.deps.safeAddEventListener(document, "click", (e) => {
            if (!e.target?.closest) return; // Guard: text nodes, SVG, etc.
            const target = e.target.closest(DOM_SELECTORS.OPEN_RECURRING_SETTINGS);
            if (!target) return;

            const taskId = target.dataset.taskId;
            if (!taskId) return;

            this.openRecurringSettingsPanelForTask(taskId);
        });
    }

    // ============================================
    // PUBLIC API METHODS
    // ============================================

    /**
     * Open the settings form populated with the currently selected task's settings
     * Called when user clicks "Change Recurring Settings" from the summary preview
     */
    openSettingsFormForSelectedTask() {
        const taskId = this.state.selectedTaskId;
        if (!taskId) {
            console.warn('⚠️ No task selected for changing settings');
            return;
        }

        // Get the task's current recurring settings from state
        if (!this.deps.AppState.isReady?.()) return;

        const state = this.deps.AppState.get();
        const activeCycleId = state.appState?.activeCycleId;
        const currentCycle = state.data?.cycles?.[activeCycleId];
        if (!currentCycle) return;

        const task = currentCycle.tasks.find(t => t.id === taskId);
        const recurringSettings = task?.recurringSettings ||
            currentCycle.recurringTemplates?.[taskId]?.recurringSettings;

        // Always collapse advanced settings when opening settings form
        this._resetAdvanced?.();

        // Enter editing mode (shows settings panel + checkboxes, hides change buttons)
        this.setPanelMode('editing');

        // Auto-check the selected task so settings apply to it
        const taskItem = this.deps.getElementById(DOM_IDS.RECURRING_TASK_LIST)
            ?.querySelector(DATA_SELECTORS.elementByTaskId(taskId));
        if (taskItem) {
            const checkbox = taskItem.querySelector(DOM_SELECTORS.RECURRING_CHECK);
            if (checkbox) {
                checkbox.checked = true;
                taskItem.classList.add(DOM_CLASSES.CHECKED);
            }
        }

        // Populate form with task's current settings
        if (recurringSettings) {
            this.populateRecurringFormWithSettings(recurringSettings);
        }
    }

    /**
     * Open recurring settings panel for a specific task
     * @param {string} taskIdToPreselect - Task ID to preselect
     */
    async openRecurringSettingsPanelForTask(taskIdToPreselect) {

        try {
            await this.updateRecurringPanel(); // Render panel fresh

            // Find and preselect the correct task
            const itemToSelect = this.deps.querySelector(DATA_SELECTORS.recurringTaskById(taskIdToPreselect));
            if (itemToSelect) {
                itemToSelect.classList.add(DOM_CLASSES.SELECTED);
                this.state.selectedTaskId = taskIdToPreselect;

                const checkbox = itemToSelect.querySelector(DOM_SELECTORS.RECURRING_CHECK);
                if (checkbox) {
                    checkbox.checked = true;
                    itemToSelect.classList.add(DOM_CLASSES.CHECKED);
                }

                // Scroll the selected task into view within the list
                requestAnimationFrame(() => {
                    const body = this.deps.getBody?.() || document.body;
                    const scrollBehavior = body.classList.contains(DOM_CLASSES.REDUCED_MOTION) ? 'auto' : 'smooth';
                    itemToSelect.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
                });

                // Show task preview
                if (this.deps.AppState.isReady?.()) {
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
                overlay._previousFocus = this.deps.getActiveElement?.() || document.activeElement;
                if (!overlay.open) overlay.showModal();
            }

            // Always collapse advanced settings when opening settings form
            this._resetAdvanced?.();

            // Enter editing mode with the preselected task
            this.setPanelMode('editing');

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
let _initEventDelegation = null;
// Setup module functions
let _setupFrequencySelector = null;
let _setupToggleVisibility = null;
let _setupToggleCheckAll = null;
let _setupAdvancedToggle = null;
let _setupHourlyMinuteWrapping = null;
let _setupMonthlyMutualExclusion = null;
let _setupAdditionalListeners = null;
let _setupSpecificDatesPanel = null;
let _setupBiweeklyDayToggle = null;
let _setupDurationRadioButtons = null;
let _attachRecurringSummaryListeners = null;

/**
 * Load sub-modules with version cache-busting
 * @param {string} version - Version string for cache-busting
 */
export async function loadPanelSubModules(version) {
    if (_buildRecurringSummaryFromSettings) {
        return; // Already loaded
    }

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
    _initEventDelegation = eventsModule.initEventDelegation;

    // Setup module
    _setupFrequencySelector = setupModule.setupFrequencySelector;
    _setupToggleVisibility = setupModule.setupToggleVisibility;
    _setupToggleCheckAll = setupModule.setupToggleCheckAll;
    _setupAdvancedToggle = setupModule.setupAdvancedToggle;
    _setupHourlyMinuteWrapping = setupModule.setupHourlyMinuteWrapping;
    _setupMonthlyMutualExclusion = setupModule.setupMonthlyMutualExclusion;
    _setupAdditionalListeners = setupModule.setupAdditionalListeners;
    _setupSpecificDatesPanel = setupModule.setupSpecificDatesPanel;
    _setupBiweeklyDayToggle = setupModule.setupBiweeklyDayToggle;
    _setupDurationRadioButtons = setupModule.setupDurationRadioButtons;
    _attachRecurringSummaryListeners = setupModule.attachRecurringSummaryListeners;

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
        return getLabel('recurring.summaryRepeats', { vars: { freq: settings.frequency || 'daily' } });
    }
    return _buildRecurringSummaryFromSettings(settings);
}

// ============================================
// EXPORTS
// ============================================

// DI-pure module (no window.* fallbacks)
