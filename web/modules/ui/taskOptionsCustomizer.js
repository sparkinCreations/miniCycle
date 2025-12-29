/**
 * @module taskOptionsCustomizer
 * @pattern Simple Instance 🎯
 * @description Manages customization of task option button visibility per cycle
 *
 * Allows users to customize which task option buttons appear for each cycle.
 * Settings are stored per-cycle in taskOptionButtons property.
 *
 * Features:
 * - Per-cycle button visibility customization
 * - Modal UI for selecting visible buttons
 * - Instant UI updates when settings change
 * - Persistent settings in AppState
 * - Sensible defaults for new cycles
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================
// NOTE: No appContext fallback - all dependencies must come through DI
// This avoids versioned/unversioned module instance mismatch issues

const di = createDIModule('TaskOptionsCustomizer', {
    AppState: optional(null),
    showNotification: optional(null),
    renderTaskList: optional(null),
    updateMoveArrowsVisibility: optional(null),
    startReminders: optional(null),
    stopReminders: optional(null),
    modeManager: optional(null),
    appInit: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null),
    safeAddEventListener: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for TaskOptionsCustomizer (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, renderTaskList, etc. }
 */
export function setTaskOptionsCustomizerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('⚙️ TaskOptionsCustomizer dependencies set:', Object.keys(dependencies));
}

// Inline fallback for DEFAULT_TASK_OPTION_BUTTONS (used if not injected)
const FALLBACK_TASK_OPTION_BUTTONS = {
    customize: true,
    moveArrows: false,
    highPriority: true,
    rename: true,
    delete: true,
    recurring: false,
    dueDate: false,
    reminders: false,
    deleteWhenComplete: false
};

// Button configuration with labels, icons, descriptions, and scope
const BUTTON_CONFIG = [
    {
        key: 'customize',
        label: 'Customize Options',
        icon: '-/+',
        disabled: true,
        scope: 'global',
        description: 'Always visible - opens this customization menu'
    },
    {
        key: 'moveArrows',
        label: 'Move Task Arrows',
        icon: '▲▼',
        scope: 'global',
        description: 'Reorder tasks up or down in list'
    },
    {
        key: 'threeDots',
        label: 'Three Dots Menu',
        icon: '⋮',
        scope: 'global',
        description: 'Show three dots button to reveal task options on click (instead of hover)'
    },
    {
        key: 'highPriority',
        label: 'High Priority Toggle',
        icon: '<i class="fas fa-exclamation-triangle"></i>',
        scope: 'cycle',
        description: 'Mark task as high priority'
    },
    {
        key: 'rename',
        label: 'Rename Task',
        icon: '✏️',
        scope: 'cycle',
        description: 'Edit task text'
    },
    {
        key: 'delete',
        label: 'Delete Task',
        icon: '🗑️',
        scope: 'cycle',
        description: 'Remove task from list'
    },
    {
        key: 'recurring',
        label: 'Recurring Task',
        icon: '🔁',
        scope: 'cycle',
        description: 'Schedule task to repeat automatically'
    },
    {
        key: 'dueDate',
        label: 'Set Due Date',
        icon: '📅',
        scope: 'cycle',
        description: 'Add deadline to task'
    },
    {
        key: 'reminders',
        label: 'Task Reminders',
        icon: '🔔',
        scope: 'cycle',
        description: 'Set notification reminders'
    },
    {
        key: 'deleteWhenComplete',
        label: 'Delete When Complete',
        icon: '❌',
        scope: 'cycle',
        description: 'Permanently remove task during auto-reset instead of unchecking'
    }
];

export class TaskOptionsCustomizer {
    constructor(deps = {}) {
        // Store constructor-only deps (DOM helpers that don't change)
        this._constructorDeps = {
            getElementById: deps.getElementById || ((id) => document.getElementById(id)),
            querySelector: deps.querySelector || ((sel) => document.querySelector(sel))
        };

        // ✅ Debounce state for refresh
        this._refreshTimeout = null;
        this._refreshDebounceMs = 150;

        // Validate required dependencies
        this._validateDependencies();

        console.log('✅ TaskOptionsCustomizer initialized');
    }

    /**
     * Schedule a debounced refresh of task buttons
     * Prevents multiple rapid renders when toggling checkboxes quickly
     */
    scheduleRefresh() {
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        this._refreshTimeout = setTimeout(() => {
            this._refreshTimeout = null;
            this.refreshAllTaskButtons();
        }, this._refreshDebounceMs);
    }

    /**
     * Getter for dependencies - always reads from current module-level _deps
     * This allows late injection via setTaskOptionsCustomizerDependencies() to work
     */
    get deps() {
        return {
            AppState: _deps.AppState,
            showNotification: _deps.showNotification,
            renderTaskList: _deps.renderTaskList,
            updateMoveArrowsVisibility: _deps.updateMoveArrowsVisibility,
            startReminders: _deps.startReminders,
            stopReminders: _deps.stopReminders,
            modeManager: _deps.modeManager,
            appInit: _deps.appInit,  // DI-pure (no fallback)
            DEFAULT_TASK_OPTION_BUTTONS: _deps.DEFAULT_TASK_OPTION_BUTTONS || FALLBACK_TASK_OPTION_BUTTONS,
            safeAddEventListener: _deps.safeAddEventListener,
            // DOM helpers from constructor
            ...this._constructorDeps
        };
    }

    /**
     * Validate dependencies and warn about missing ones
     * @private
     */
    _validateDependencies() {
        const required = ['AppState', 'showNotification'];
        const missing = required.filter(dep => !this.deps[dep]);

        if (missing.length > 0) {
            console.warn('⚠️ TaskOptionsCustomizer missing dependencies:', missing);
        }
    }

    /**
     * Setup event listeners for opening customizer from settings
     */
    setupEventListeners() {
        // ✅ Idempotency guard to prevent duplicate listeners
        if (this._eventListenersInitialized) {
            console.log('✅ TaskOptionsCustomizer event listeners already set up');
            return;
        }
        this._eventListenersInitialized = true;

        // Use safeAddEventListener (prefer injected, fallback inline)
        const safeAdd = this.deps.safeAddEventListener;

        // Wait for DOM to be ready, then attach listener
        const attachListener = () => {
            const openButton = document.getElementById('open-task-options-customizer');
            if (openButton) {
                openButton._clickHandler = () => {
                    const state = this.deps.AppState?.get();
                    const currentCycleId = state?.appState?.activeCycleId;

                    if (currentCycleId) {
                        // Close the settings modal first
                        const settingsModal = document.querySelector('.settings-modal');
                        if (settingsModal) {
                            settingsModal.style.display = 'none';
                        }

                        // Then open the customization modal
                        this.showCustomizationModal(currentCycleId);
                    } else {
                        this.deps.showNotification?.('Please select a cycle first', 'warning');
                    }
                };
                safeAdd(openButton, 'click', openButton._clickHandler);
                console.log('✅ Task options customizer event listeners attached');
            } else {
                console.warn('⚠️ open-task-options-customizer button not found');
            }

            // ✅ Check if we need to re-open customizer after page reload
            this.checkAndReopenAfterReload();
        };

        // Try immediately, and also on DOMContentLoaded
        if (document.readyState === 'loading') {
            document._taskCustomizerDOMContentLoaded = attachListener;
            safeAdd(document, 'DOMContentLoaded', document._taskCustomizerDOMContentLoaded);
        } else {
            attachListener();
        }
    }

    /**
     * Check if customizer should re-open after page reload
     * Called after page loads to restore customizer modal if user was customizing before reload
     */
    async checkAndReopenAfterReload() {
        const shouldReopen = sessionStorage.getItem('reopenTaskCustomizer');
        if (shouldReopen === 'true') {
            // Clear the flag
            sessionStorage.removeItem('reopenTaskCustomizer');

            // Wait a bit for everything to be ready
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get current cycle and re-open modal
            const state = this.deps.AppState?.get();
            const currentCycleId = state?.appState?.activeCycleId;

            if (currentCycleId) {
                console.log('🔄 Re-opening task customizer after reload...');
                this.showCustomizationModal(currentCycleId);
            }
        }
    }

    /**
     * Show customization modal for a specific cycle
     * @param {string} cycleId - The cycle ID to customize
     */
    async showCustomizationModal(cycleId) {
        // DI-pure: use injected appInit
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready');
            return;
        }

        const state = this.deps.AppState.get();
        const cycle = state.data.cycles[cycleId];

        if (!cycle) {
            console.error(`❌ Cycle not found: ${cycleId}`);
            return;
        }

        const currentOptions = cycle.taskOptionButtons || { ...this.deps.DEFAULT_TASK_OPTION_BUTTONS };

        // ✅ Sync move arrows with global setting
        // Move arrows should always reflect the global state.ui.moveArrowsVisible setting
        const globalMoveArrowsEnabled = state.ui?.moveArrowsVisible || false;
        currentOptions.moveArrows = globalMoveArrowsEnabled;

        // ✅ Sync three dots with global setting
        // Three dots should always reflect the global state.settings.showThreeDots setting
        const globalThreeDotsEnabled = state.settings?.showThreeDots || false;
        currentOptions.threeDots = globalThreeDotsEnabled;

        // Create and show modal
        this.createModal(cycleId, cycle.title, currentOptions);
    }

    /**
     * Create the customization modal
     * @param {string} cycleId - The cycle ID
     * @param {string} cycleTitle - The cycle title for display
     * @param {Object} currentOptions - Current button visibility settings
     */
    createModal(cycleId, cycleTitle, currentOptions) {
        // Remove any existing modal
        const existing = this.deps.getElementById('task-options-customizer-modal');
        if (existing) existing.remove();

        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'task-options-customizer-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content task-options-modal">
                <div class="modal-header">
                    <img src="assets/images/logo/taskcycle_logo_blackandwhite_transparent.png" alt="miniCycle Logo" class="modal-logo">
                    <div class="modal-header-text">
                        <h2>⚙️ Customize Task Options</h2>
                        <p class="modal-subtitle">Choose which buttons appear for tasks in "${cycleTitle}"</p>
                    </div>
                </div>

                <div class="modal-body">
                    <div class="task-options-container">
                        <div class="task-options-list">
                            ${this.buildOptionsList(currentOptions)}
                        </div>
                        <div class="task-option-preview">
                            <div class="preview-header">
                                <span class="preview-icon">ℹ️</span>
                                <h3>Option Details</h3>
                            </div>
                            <div id="option-preview-content" class="preview-content">
                                <p class="preview-placeholder"><span class="desktop-text">Hover over</span><span class="mobile-text">Tap</span> an option to see details</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <p class="modal-footer-note">Changes apply immediately</p>
                    <button id="reset-task-options-btn" class="secondary-button">
                        🔄 Reset to Default
                    </button>
                    <button id="close-task-options-btn" class="close-button-fullwidth">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Attach event listeners
        this.attachModalListeners(modal, cycleId);

        // Show modal with animation
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    /**
     * Build the options list HTML with sections for global and per-cycle options
     * @param {Object} currentOptions - Current button visibility settings
     * @returns {string} HTML for options list
     */
    buildOptionsList(currentOptions) {
        const globalOptions = BUTTON_CONFIG.filter(opt => opt.scope === 'global');
        const cycleOptions = BUTTON_CONFIG.filter(opt => opt.scope === 'cycle');

        const defaultButtons = this.deps.DEFAULT_TASK_OPTION_BUTTONS;
        const buildOption = (option) => {
            const isChecked = currentOptions[option.key] ?? defaultButtons[option.key];
            const isDisabled = option.disabled || false;

            // Store the icon index instead of HTML to avoid escaping issues
            const iconIndex = BUTTON_CONFIG.findIndex(cfg => cfg.key === option.key);

            return `
                <label class="task-option-item ${isDisabled ? 'disabled' : ''}"
                       data-option-key="${option.key}"
                       data-option-index="${iconIndex}"
                       data-option-label="${option.label}"
                       data-option-description="${option.description}">
                    <div class="option-checkbox-container">
                        <input
                            type="checkbox"
                            id="option-${option.key}"
                            name="option-${option.key}"
                            data-option="${option.key}"
                            ${isChecked ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                            class="option-checkbox"
                        >
                        <span class="custom-checkbox"></span>
                    </div>
                    <div class="option-compact-content">
                        <span class="option-icon">${option.icon}</span>
                        <span class="option-label">${option.label}</span>
                        ${isDisabled ? '<span class="always-visible-badge">Always</span>' : ''}
                    </div>
                </label>
            `;
        };

        return `
            <div class="options-section">
                <div class="section-header">
                    <h3>📋 This Cycle</h3>
                </div>
                <div class="section-options">
                    ${cycleOptions.map(buildOption).join('')}
                </div>
            </div>
            <div class="options-section">
                <div class="section-header">
                    <h3>🌐 Global</h3>
                </div>
                <div class="section-options">
                    ${globalOptions.map(buildOption).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to modal elements
     * @param {HTMLElement} modal - The modal element
     * @param {string} cycleId - The cycle ID
     */
    attachModalListeners(modal, cycleId) {
        const closeBtn = modal.querySelector('#close-task-options-btn');
        const resetBtn = modal.querySelector('#reset-task-options-btn');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        const optionItems = modal.querySelectorAll('.task-option-item');
        const previewContent = modal.querySelector('#option-preview-content');

        // Use safeAddEventListener (prefer injected, fallback inline)
        const safeAdd = this.deps.safeAddEventListener;

        // ✅ Real-time saving: Save immediately when any checkbox changes
        checkboxes.forEach(checkbox => {
            checkbox._changeHandler = () => {
                this.saveCustomization(cycleId, checkboxes);
            };
            safeAdd(checkbox, 'change', checkbox._changeHandler);
        });

        // ✅ Preview panel: Update on hover/tap
        const showPreview = (item) => {
            const optionIndex = parseInt(item.dataset.optionIndex);
            const label = item.dataset.optionLabel;
            const description = item.dataset.optionDescription;

            // Get icon from BUTTON_CONFIG to avoid HTML escaping issues
            const icon = BUTTON_CONFIG[optionIndex]?.icon || '';

            previewContent.innerHTML = `
                <div class="preview-option-icon">${icon}</div>
                <h4 class="preview-option-title">${label}</h4>
                <p class="preview-option-description">${description}</p>
            `;
        };

        const hidePreview = () => {
            previewContent.innerHTML = '<p class="preview-placeholder"><span class="desktop-text">Hover over</span><span class="mobile-text">Tap</span> an option to see details</p>';
        };

        optionItems.forEach(item => {
            // Desktop: hover
            item._mouseenterHandler = () => showPreview(item);
            item._mouseleaveHandler = hidePreview;
            safeAdd(item, 'mouseenter', item._mouseenterHandler);
            safeAdd(item, 'mouseleave', item._mouseleaveHandler);

            // Mobile: tap
            item._clickHandler = (e) => {
                // Only show preview on tap, don't prevent checkbox toggle
                if (!e.target.classList.contains('option-checkbox')) {
                    showPreview(item);
                }
            };
            safeAdd(item, 'click', item._clickHandler);
        });

        // Close button
        closeBtn._clickHandler = () => {
            this.closeModal(modal);
        };
        safeAdd(closeBtn, 'click', closeBtn._clickHandler);

        // Reset button - now applies immediately
        resetBtn._clickHandler = () => {
            this.resetToDefaults(checkboxes);
            // Save after resetting
            this.saveCustomization(cycleId, checkboxes);
        };
        safeAdd(resetBtn, 'click', resetBtn._clickHandler);

        // Close on overlay click
        modal._overlayClickHandler = (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        };
        safeAdd(modal, 'click', modal._overlayClickHandler);

        // Close on ESC key
        modal._escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', modal._escHandler);
            }
        };
        safeAdd(document, 'keydown', modal._escHandler);
    }

    /**
     * Save customization to AppState
     * @param {string} cycleId - The cycle ID
     * @param {NodeList} checkboxes - Checkbox elements
     */
    async saveCustomization(cycleId, checkboxes) {
        // ✅ Collect all checkbox values
        const allOptions = {};
        checkboxes.forEach(cb => {
            allOptions[cb.dataset.option] = cb.checked;
        });

        // Ensure customize button is always enabled
        allOptions.customize = true;

        // ✅ Separate global options from cycle options
        // Global options should NOT be stored in cycle.taskOptionButtons
        const globalKeys = ['moveArrows', 'threeDots', 'customize'];
        const cycleOnlyOptions = {};
        for (const [key, value] of Object.entries(allOptions)) {
            if (!globalKeys.includes(key)) {
                cycleOnlyOptions[key] = value;
            }
        }
        // Keep customize in cycle options (it's always true anyway)
        cycleOnlyOptions.customize = true;

        // ✅ Get current state ONCE before update
        const currentState = this.deps.AppState.get();
        const currentGlobalMoveArrows = currentState.ui?.moveArrowsVisible || false;
        const currentThreeDots = currentState.settings?.showThreeDots || false;
        const cycle = currentState.data.cycles[cycleId];
        const currentRemindersEnabled = cycle?.reminders?.enabled || false;

        // ✅ New values from checkboxes
        const newMoveArrows = allOptions.moveArrows || false;
        const newThreeDots = allOptions.threeDots || false;
        const newRemindersEnabled = allOptions.reminders || false;

        // ✅ Track what changed for post-update side effects
        const moveArrowsChanged = newMoveArrows !== currentGlobalMoveArrows;
        const threeDotsChanged = newThreeDots !== currentThreeDots;
        const remindersChanged = newRemindersEnabled !== currentRemindersEnabled;

        // ✅ SINGLE AppState.update() - all changes in one atomic transaction
        await this.deps.AppState.update(state => {
            // Save cycle-only options (without global keys)
            if (state.data.cycles[cycleId]) {
                state.data.cycles[cycleId].taskOptionButtons = cycleOnlyOptions;
            }

            // Sync move arrows global setting
            if (moveArrowsChanged) {
                if (!state.ui) state.ui = {};
                state.ui.moveArrowsVisible = newMoveArrows;
                console.log(`✅ Synced global move arrows: ${newMoveArrows}`);
            }

            // Sync three dots global setting
            if (threeDotsChanged) {
                if (!state.settings) state.settings = {};
                state.settings.showThreeDots = newThreeDots;
                console.log(`✅ Synced global three dots: ${newThreeDots}`);
            }

            // Sync reminders enabled for this cycle
            if (remindersChanged && state.data.cycles[cycleId]?.reminders) {
                state.data.cycles[cycleId].reminders.enabled = newRemindersEnabled;
                console.log(`✅ Set reminders enabled: ${newRemindersEnabled}`);
            }

            state.metadata.lastModified = Date.now();
        }, true); // immediate save

        // ✅ Post-update side effects (DOM syncing)

        // Move arrows DOM updates
        if (moveArrowsChanged) {
            const updateMoveArrowsVisibility = this.deps.updateMoveArrowsVisibility;
            if (typeof updateMoveArrowsVisibility === 'function') {
                updateMoveArrowsVisibility();
            }
            const settingsMoveArrowsToggle = document.getElementById('toggle-move-arrows');
            if (settingsMoveArrowsToggle) {
                settingsMoveArrowsToggle.checked = newMoveArrows;
            }
        }

        // Three dots DOM updates
        if (threeDotsChanged) {
            const settingsThreeDotsToggle = document.getElementById('toggle-three-dots');
            if (settingsThreeDotsToggle) {
                settingsThreeDotsToggle.checked = newThreeDots;
            }
            document.body.classList.toggle('show-three-dots-enabled', newThreeDots);
        }

        // Reminders DOM updates and system start/stop
        if (remindersChanged) {
            const enableRemindersCheckbox = document.getElementById('enableReminders');
            if (enableRemindersCheckbox) {
                enableRemindersCheckbox.checked = newRemindersEnabled;
                const frequencySection = document.getElementById('frequency-section');
                if (frequencySection) {
                    frequencySection.classList.toggle('hidden', !newRemindersEnabled);
                }
            }

            // Start/stop reminders system
            if (newRemindersEnabled) {
                const startReminders = this.deps.startReminders;
                if (typeof startReminders === 'function') {
                    setTimeout(() => startReminders(), 200);
                }
            } else {
                const stopReminders = this.deps.stopReminders;
                if (typeof stopReminders === 'function') {
                    stopReminders();
                }
            }
        }

        // ✅ Refresh task list UI (debounced)
        this.scheduleRefresh();

        this.deps.showNotification?.('✅ Task options updated', 'success', 2000);
        console.log(`✅ Saved task options for cycle: ${cycleId}`, { cycleOnlyOptions, moveArrows: newMoveArrows, threeDots: newThreeDots });
    }

    /**
     * Reset all checkboxes to default values
     * @param {NodeList} checkboxes - Checkbox elements
     */
    resetToDefaults(checkboxes) {
        const defaultButtons = this.deps.DEFAULT_TASK_OPTION_BUTTONS;
        checkboxes.forEach(cb => {
            const defaultValue = defaultButtons[cb.dataset.option];
            cb.checked = defaultValue ?? false;
        });

        this.deps.showNotification?.('🔄 Reset to defaults', 'info', 2000);
    }

    /**
     * Close and remove modal
     * @param {HTMLElement} modal - The modal element
     */
    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300); // Wait for fade-out animation
    }

    /**
     * Refresh task button visibility for all tasks
     * Re-renders the entire task list with updated button visibility
     */
    async refreshAllTaskButtons() {
        // allow checkbox event + AppState listeners to finish
        await Promise.resolve();

        // DI-pure: use injected renderTaskList
        const renderFn = this.deps.renderTaskList;

        if (typeof renderFn === "function") {
            await renderFn();
            console.log("✅ Task list re-rendered with updated button visibility");
            return;
        }

        // Fallback: rebuild just the option buttons if renderer not found (DI-pure)
        const modeManager = this.deps.modeManager;
        if (modeManager?.refreshTaskButtonsForModeChange) {
            modeManager.refreshTaskButtonsForModeChange();
            console.log("✅ ModeManager button refresh triggered");
            return;
        }

        console.warn("⚠️ No valid task refresh function found");
    }

    /**
     * Get button visibility settings for a cycle
     * Merges cycle-specific options with global settings
     * @param {string} cycleId - The cycle ID
     * @returns {Object} Button visibility settings
     */
    getButtonVisibility(cycleId) {
        const defaultButtons = this.deps.DEFAULT_TASK_OPTION_BUTTONS;
        const state = this.deps.AppState?.get?.();
        if (!state) return { ...defaultButtons };

        const cycle = state.data.cycles[cycleId];
        const cycleOptions = cycle?.taskOptionButtons || {};

        // ✅ Merge cycle options with global settings
        // Global options are stored separately, not in cycle.taskOptionButtons
        return {
            ...defaultButtons,
            ...cycleOptions,
            // Always read global options from their canonical locations
            moveArrows: state.ui?.moveArrowsVisible || false,
            threeDots: state.settings?.showThreeDots || false,
            customize: true // Always enabled
        };
    }
}

// ============================================
// Global Instance
// ============================================

let taskOptionsCustomizer = null;

/**
 * Initialize the task options customizer
 * @param {Object} dependencies - Dependency injection object
 * @returns {TaskOptionsCustomizer} The initialized instance
 */
export async function initTaskOptionsCustomizer(dependencies = {}) {
    if (taskOptionsCustomizer) {
        console.warn('⚠️ TaskOptionsCustomizer already initialized');
        return taskOptionsCustomizer;
    }

    taskOptionsCustomizer = new TaskOptionsCustomizer(dependencies);

    // Setup event listeners for settings button
    taskOptionsCustomizer.setupEventListeners();

    // Phase 3 - No window.* exports (main script handles exposure)
    return taskOptionsCustomizer;
}

export { taskOptionsCustomizer };

// DI-pure module (no window.* fallbacks)
console.log('✅ TaskOptionsCustomizer module loaded (DI-pure, no window.* exports)');
