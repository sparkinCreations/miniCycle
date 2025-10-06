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
 * @version 1.0.0
 * @requires recurringCore (via dependency injection)
 */

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
            selectedTaskId: null
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

            // Setup frequency selector
            this.setupFrequencySelector();

            // Setup toggle visibility checkboxes
            this.setupToggleVisibility();

            // Setup toggle check all button
            this.setupToggleCheckAll();

            // Setup advanced settings toggle
            this.setupAdvancedToggle();

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
            const advancedPanel = this.deps.getElementById("advanced-recurring-settings");
            if (advancedPanel) {
                advancedPanel.classList.toggle("hidden", !visible);
            }
            toggleBtn.textContent = visible ? "Hide Advanced" : "Show Advanced";
        };

        setAdvancedVisibility(advancedVisible);

        toggleBtn.addEventListener("click", () => {
            advancedVisible = !advancedVisible;
            setAdvancedVisibility(advancedVisible);
        });
    }

    // ============================================
    // PANEL OPEN/CLOSE
    // ============================================

    /**
     * Open the recurring panel
     */
    openPanel() {
        console.log('🔁 Opening recurring panel...');

        try {
            // Check AppState readiness
            if (!this.deps.isAppStateReady()) {
                console.warn('⚠️ AppState not ready for panel open');
                this.deps.showNotification('Data not ready - please wait', 'warning');
                return;
            }

            // Update panel with current data
            this.updateRecurringPanel();

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
    updateRecurringPanel(currentCycleData = null) {
        console.log('🔄 Updating recurring panel...');

        try {
            const recurringList = this.deps.getElementById("recurring-task-list");
            if (!recurringList) {
                console.warn('⚠️ Recurring task list element not found');
                return;
            }

            // ✅ Use AppState only - no fallback to avoid state drift
            if (!this.deps.isAppStateReady()) {
                console.warn('⚠️ AppState not ready for updateRecurringPanel');
                return;
            }

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

            const templateTasks = Object.values(cycleData.recurringTemplates || {});
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
                return;
            }

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
            const fullTask = cycleData.tasks.find(t => t.id === task.id) || task;
            this.showTaskSummaryPreview(fullTask);
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
                    const schemaData = this.deps.loadData();
                    if (!schemaData) {
                        console.error('❌ Schema 2.5 data required for task removal');
                        return;
                    }

                    const { cycles, activeCycle } = schemaData;
                    const currentCycle = cycles[activeCycle];

                    // Remove recurrence from the live task
                    const liveTask = currentCycle.tasks.find(t => t.id === task.id);
                    if (liveTask) {
                        liveTask.recurring = false;
                        delete liveTask.recurringSettings;
                    }

                    // Delete from recurringTemplates
                    delete currentCycle.recurringTemplates[task.id];

                    // Update the full schema data
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle] = currentCycle;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

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

                    const remaining = Object.values(currentCycle.recurringTemplates || {});
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

            summaryContainer.innerHTML = "";

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

            if (!recurringSettings) {
                summaryContainer.innerHTML = `
                    <div class="task-preview-item">
                        <strong>${task.text}</strong>
                        <p>No recurring settings configured</p>
                    </div>
                `;
                return;
            }

            const summaryText = this.deps.buildRecurringSummary(recurringSettings);

            summaryContainer.innerHTML = `
                <div class="task-preview-item">
                    <strong>${task.text}</strong>
                    <p class="recurring-summary-text">${summaryText}</p>
                </div>
            `;

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
                hourly: {
                    useSpecificMinute: false,
                    minute: 0
                },
                weekly: {
                    days: []
                },
                biweekly: {
                    days: []
                },
                monthly: {
                    days: []
                },
                yearly: {
                    months: [],
                    useSpecificDays: false,
                    applyDaysToAll: true,
                    daysByMonth: {}
                }
            };

            // Add frequency-specific settings extraction here
            // This would involve reading checkboxes, day selectors, etc.
            // Simplified for now - can be extended as needed

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
            if (!panelButton) return;

            // Simple check: get current data and look for recurring tasks
            let hasRecurring = false;

            try {
                const schemaData = this.deps.loadData();
                if (schemaData?.cycles?.[schemaData.activeCycle]) {
                    const cycle = schemaData.cycles[schemaData.activeCycle];
                    hasRecurring = cycle.tasks.some(task => task.recurring) ||
                        Object.keys(cycle.recurringTemplates || {}).length > 0;
                }
            } catch (error) {
                console.warn('Could not check recurring tasks:', error);
                return;
            }

            panelButton.classList.toggle("hidden", !hasRecurring);

        } catch (error) {
            console.error('❌ Error updating panel button visibility:', error);
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
    openRecurringSettingsPanelForTask(taskIdToPreselect) {
        console.log('⚙️ Opening recurring settings panel for task:', taskIdToPreselect);

        try {
            this.updateRecurringPanel(); // Render panel fresh

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
