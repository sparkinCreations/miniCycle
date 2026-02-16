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
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

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
    safeAddEventListener: optional(null),
    getModal: optional(null)
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

// SVG icons for the customizer modal (same as taskButtons.js)
const CUSTOMIZER_ICONS = {
    'exclamation-triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S480.9 480 466.7 480H45.3c-14.2 0-27.3-7.5-34.5-19.8s-7.3-27.7-.2-40.1l216-368C233.9 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>',
    'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></svg>',
    'trash': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 448 512" fill="currentColor"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>',
    'repeat': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96H320v32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32V64H160C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96H192V352c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V448H352c88.4 0 160-71.6 160-160z"/></svg>',
    'calendar-alt': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 448 512" fill="currentColor"><path d="M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v16 48V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192 144 128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM48 192H400V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192z"/></svg>',
    'bell': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 448 512" fill="currentColor"><path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/></svg>'
};

// Button configuration with label keys, icons, and scope
// Labels and descriptions are resolved via getLabel() at render time
const BUTTON_CONFIG = [
    {
        key: 'customize',
        labelKey: 'taskOptions.customizeLabel',
        icon: '-/+',
        disabled: true,
        scope: 'global',
        descriptionKey: 'taskOptions.customizeDescription'
    },
    {
        key: 'moveArrows',
        labelKey: 'taskOptions.moveArrowsLabel',
        icon: '▲▼',
        scope: 'global',
        descriptionKey: 'taskOptions.moveArrowsDescription'
    },
    {
        key: 'threeDots',
        labelKey: 'taskOptions.threeDotsLabel',
        icon: '⋮',
        scope: 'global',
        descriptionKey: 'taskOptions.threeDotsDescription'
    },
    {
        key: 'highPriority',
        labelKey: 'taskOptions.highPriority',
        icon: CUSTOMIZER_ICONS['exclamation-triangle'],
        scope: 'cycle',
        descriptionKey: 'taskOptions.highPriorityDescription'
    },
    {
        key: 'rename',
        labelKey: 'taskOptions.renameTask',
        icon: CUSTOMIZER_ICONS['edit'],
        scope: 'cycle',
        descriptionKey: 'taskOptions.renameDescription'
    },
    {
        key: 'delete',
        labelKey: 'taskOptions.deleteTask',
        icon: CUSTOMIZER_ICONS['trash'],
        scope: 'cycle',
        descriptionKey: 'taskOptions.deleteDescription'
    },
    {
        key: 'recurring',
        labelKey: 'taskOptions.recurringTask',
        icon: CUSTOMIZER_ICONS['repeat'],
        scope: 'cycle',
        descriptionKey: 'taskOptions.recurringDescription'
    },
    {
        key: 'dueDate',
        labelKey: 'taskOptions.setDueDate',
        icon: CUSTOMIZER_ICONS['calendar-alt'],
        scope: 'cycle',
        descriptionKey: 'taskOptions.dueDateDescription'
    },
    {
        key: 'reminders',
        labelKey: 'taskOptions.taskReminders',
        icon: CUSTOMIZER_ICONS['bell'],
        scope: 'cycle',
        descriptionKey: 'taskOptions.remindersDescription'
    },
    {
        key: 'deleteWhenComplete',
        labelKey: 'taskOptions.markedForRemoval',
        icon: '❌',
        scope: 'cycle',
        descriptionKey: 'taskOptions.markedForRemovalDescription'
    }
];

export class TaskOptionsCustomizer {
    constructor() {
        this._refreshTimeout = null;
        this._refreshDebounceMs = 150;
        this._modalRemoveTimerId = null;

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

    get deps() {
        const resolved = di.resolve();
        return {
            ...resolved,
            DEFAULT_TASK_OPTION_BUTTONS: resolved.DEFAULT_TASK_OPTION_BUTTONS || FALLBACK_TASK_OPTION_BUTTONS
        };
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
            const openButton = document.getElementById(DOM_IDS.OPEN_TASK_OPTIONS_CUSTOMIZER);
            if (openButton) {
                openButton._clickHandler = () => {
                    const state = this.deps.AppState?.get();
                    const currentCycleId = state?.appState?.activeCycleId;

                    if (currentCycleId) {
                        // Close the settings modal first
                        const settingsModal = this.deps.getModal?.('settings') || document.querySelector(DOM_SELECTORS.SETTINGS_MODAL);
                        if (settingsModal?.open) {
                            settingsModal.close();
                        }

                        // Then open the customization modal
                        this.showCustomizationModal(currentCycleId);
                    } else {
                        this.deps.showNotification?.(getLabel('notify.selectCycleFirst'), 'warning');
                    }
                };
                safeAdd(openButton, 'click', openButton._clickHandler);
                console.log('✅ Task options customizer event listeners attached');
            } else {
                console.warn('⚠️ open-task-options-customizer button not found');
            }

            // Also attach listener for menu button (quick access from main menu)
            const menuButton = document.getElementById(DOM_IDS.MENU_TASK_OPTIONS);
            if (menuButton) {
                menuButton._clickHandler = () => {
                    const state = this.deps.AppState?.get();
                    const currentCycleId = state?.appState?.activeCycleId;

                    if (currentCycleId) {
                        // Close the menu first
                        const menuContainer = document.querySelector(DOM_SELECTORS.MENU_CONTAINER);
                        if (menuContainer) {
                            menuContainer.classList.remove('visible');
                        }

                        // Then open the customization modal
                        this.showCustomizationModal(currentCycleId);
                    } else {
                        this.deps.showNotification?.(getLabel('notify.selectRoutineFirst'), 'warning');
                    }
                };
                safeAdd(menuButton, 'click', menuButton._clickHandler);
                console.log('✅ Task options menu button listener attached');
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
            await new Promise(resolve => setTimeout(resolve, UI_TIMEOUTS.MODAL_ANIMATION));

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
        const existing = document.getElementById(DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL);
        if (existing) existing.remove();

        // Create modal HTML
        const modal = document.createElement('dialog');
        modal.id = DOM_IDS.TASK_OPTIONS_CUSTOMIZER_MODAL;

        // Fix #39: Escape cycleTitle to prevent XSS
        const escapeHtml = (str) => {
            if (typeof str !== 'string') return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
        };

        modal.setAttribute('aria-labelledby', 'task-options-customizer-title');

        modal.innerHTML = `
            <div class="modal-content task-options-modal has-corner-logo">
                <div class="modal-header">
                    <div class="modal-header-text">
                        <h2 id="task-options-customizer-title">⚙️ ${getLabel('taskOptions.title')}</h2>
                        <p class="modal-subtitle">${getLabel('taskOptions.subtitle', { vars: { name: escapeHtml(cycleTitle) } })}</p>
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
                                <h3>${getLabel('taskOptions.optionDetails')}</h3>
                            </div>
                            <div id="${DOM_IDS.OPTION_PREVIEW_CONTENT}" class="preview-content">
                                <p class="preview-placeholder"><span class="desktop-text">${getLabel('taskOptions.previewHover')}</span><span class="mobile-text">${getLabel('taskOptions.previewTap')}</span> ${getLabel('taskOptions.previewInstruction')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <div class="modal-footer-row">
                        <p class="modal-footer-note">${getLabel('taskOptions.changesApply')}</p>
                        <button id="${DOM_IDS.RESET_TASK_OPTIONS_BTN}">
                            🔄 ${getLabel('taskOptions.resetDefault')}
                        </button>
                    </div>
                    <button id="${DOM_IDS.CLOSE_TASK_OPTIONS_BTN}" class="close-button-fullwidth">
                        ${getLabel('button.close')}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Attach event listeners
        this.attachModalListeners(modal, cycleId);

        // Show modal using native dialog API
        modal._previousFocus = document.activeElement;
        modal.showModal();
        // Focus first interactive element
        const firstFocusable = modal.querySelector('input:not([disabled]), button');
        if (firstFocusable) setTimeout(() => firstFocusable.focus({ focusVisible: false }), 100);
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
        const escapeAttr = (str) => String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const buildOption = (option) => {
            const isChecked = currentOptions[option.key] ?? defaultButtons[option.key];
            const isDisabled = option.disabled || false;
            const label = getLabel(option.labelKey);
            const description = getLabel(option.descriptionKey);

            // Store the icon index instead of HTML to avoid escaping issues
            const iconIndex = BUTTON_CONFIG.findIndex(cfg => cfg.key === option.key);

            return `
                <label class="task-option-item ${isDisabled ? 'disabled' : ''}"
                       data-option-key="${option.key}"
                       data-option-index="${iconIndex}"
                       data-option-label="${escapeAttr(label)}"
                       data-option-description="${escapeAttr(description)}">
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
                        <span class="option-label">${label}</span>
                        ${isDisabled ? `<span class="always-visible-badge">${getLabel('taskOptions.alwaysBadge')}</span>` : ''}
                    </div>
                </label>
            `;
        };

        return `
            <div class="options-section">
                <div class="section-header">
                    <h3>📋 ${getLabel('taskOptions.thisCycle')}</h3>
                </div>
                <div class="section-options">
                    ${cycleOptions.map(buildOption).join('')}
                </div>
            </div>
            <div class="options-section">
                <div class="section-header">
                    <h3>🌐 ${getLabel('taskOptions.global')}</h3>
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
        const closeBtn = modal.querySelector(`#${DOM_IDS.CLOSE_TASK_OPTIONS_BTN}`);
        const resetBtn = modal.querySelector(`#${DOM_IDS.RESET_TASK_OPTIONS_BTN}`);
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        const optionItems = modal.querySelectorAll(DOM_SELECTORS.TASK_OPTION_ITEM);
        const previewContent = modal.querySelector(`#${DOM_IDS.OPTION_PREVIEW_CONTENT}`);

        // Use safeAddEventListener (prefer injected, fallback inline)
        const safeAdd = this.deps.safeAddEventListener;

        // ✅ Real-time saving: Save immediately when any checkbox changes
        checkboxes.forEach(checkbox => {
            checkbox._changeHandler = () => {
                this.saveCustomization(cycleId, checkboxes);
            };
            safeAdd(checkbox, 'change', checkbox._changeHandler);

            // Keyboard: Enter toggles, Arrow Up/Down navigates between options
            checkbox._keydownHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!checkbox.disabled) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const visible = [...modal.querySelectorAll('input[type="checkbox"]:not(:disabled)')]
                        .filter(cb => cb.offsetParent !== null);
                    const idx = visible.indexOf(checkbox);
                    if (idx === -1) return;
                    const next = e.key === 'ArrowDown'
                        ? (idx + 1) % visible.length
                        : (idx - 1 + visible.length) % visible.length;
                    visible[next].focus();
                }
            };
            safeAdd(checkbox, 'keydown', checkbox._keydownHandler);
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
            previewContent.innerHTML = `<p class="preview-placeholder"><span class="desktop-text">${getLabel('taskOptions.previewHover')}</span><span class="mobile-text">${getLabel('taskOptions.previewTap')}</span> ${getLabel('taskOptions.previewInstruction')}</p>`;
        };

        optionItems.forEach(item => {
            // Desktop: hover
            item._mouseenterHandler = () => showPreview(item);
            item._mouseleaveHandler = hidePreview;
            safeAdd(item, 'mouseenter', item._mouseenterHandler);
            safeAdd(item, 'mouseleave', item._mouseleaveHandler);

            // Keyboard: show preview when checkbox receives focus
            const checkbox = item.querySelector('.option-checkbox');
            if (checkbox) {
                checkbox._focusHandler = () => showPreview(item);
                safeAdd(checkbox, 'focus', checkbox._focusHandler);
            }

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

        // Handle ESC via native dialog cancel event
        safeAdd(modal, 'cancel', (e) => {
            e.preventDefault(); // Prevent native close to do our cleanup
            this.closeModal(modal);
        });
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
            const settingsMoveArrowsToggle = document.getElementById(DOM_IDS.TOGGLE_MOVE_ARROWS);
            if (settingsMoveArrowsToggle) {
                settingsMoveArrowsToggle.checked = newMoveArrows;
            }
        }

        // Three dots DOM updates
        if (threeDotsChanged) {
            const settingsThreeDotsToggle = document.getElementById(DOM_IDS.TOGGLE_THREE_DOTS);
            if (settingsThreeDotsToggle) {
                settingsThreeDotsToggle.checked = newThreeDots;
            }
            document.body.classList.toggle('show-three-dots-enabled', newThreeDots);

            // Show tip when disabling on touch devices
            if (!newThreeDots && ('ontouchstart' in window)) {
                setTimeout(() => {
                    this.deps.showNotification?.('💡 ' + getLabel('notify.threeDotsDisabledTip'), 'info', 4000);
                }, 300);
            }
        }

        // Reminders DOM updates and system start/stop
        if (remindersChanged) {
            const enableRemindersCheckbox = document.getElementById(DOM_IDS.ENABLE_REMINDERS);
            if (enableRemindersCheckbox) {
                enableRemindersCheckbox.checked = newRemindersEnabled;
                const frequencySection = document.getElementById(DOM_IDS.FREQUENCY_SECTION);
                if (frequencySection) {
                    frequencySection.classList.toggle('hidden', !newRemindersEnabled);
                }
            }

            // Start/stop reminders system
            if (newRemindersEnabled) {
                const startReminders = this.deps.startReminders;
                if (typeof startReminders === 'function') {
                    setTimeout(() => startReminders(), UI_TIMEOUTS.ANIMATION_SHORT);
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

        this.deps.showNotification?.('✅ ' + getLabel('notify.taskOptionsUpdated'), 'success', 2000);
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

        this.deps.showNotification?.('🔄 ' + getLabel('notify.taskOptionsReset'), 'info', 2000);
    }

    /**
     * Close and remove modal
     * @param {HTMLElement} modal - The modal element
     */
    closeModal(modal) {
        // Restore focus to previously focused element
        modal._previousFocus?.focus({ focusVisible: false });

        // Clear pending debounced refresh
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
            this._refreshTimeout = null;
        }

        // Clear any pending modal removal from a previous close
        if (this._modalRemoveTimerId) {
            clearTimeout(this._modalRemoveTimerId);
            this._modalRemoveTimerId = null;
        }

        // Clean up stored handlers on child elements before removal
        modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb._changeHandler) { cb.removeEventListener('change', cb._changeHandler); cb._changeHandler = null; }
            if (cb._focusHandler) { cb.removeEventListener('focus', cb._focusHandler); cb._focusHandler = null; }
            if (cb._keydownHandler) { cb.removeEventListener('keydown', cb._keydownHandler); cb._keydownHandler = null; }
        });
        modal.querySelectorAll('.task-option-item').forEach(item => {
            if (item._mouseenterHandler) { item.removeEventListener('mouseenter', item._mouseenterHandler); item._mouseenterHandler = null; }
            if (item._mouseleaveHandler) { item.removeEventListener('mouseleave', item._mouseleaveHandler); item._mouseleaveHandler = null; }
            if (item._clickHandler) { item.removeEventListener('click', item._clickHandler); item._clickHandler = null; }
        });
        if (modal._overlayClickHandler) { modal.removeEventListener('click', modal._overlayClickHandler); modal._overlayClickHandler = null; }

        modal.close();
        this._modalRemoveTimerId = setTimeout(() => {
            this._modalRemoveTimerId = null;
            modal.remove();
        }, 300);
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
export async function initTaskOptionsCustomizer() {
    if (taskOptionsCustomizer) {
        console.warn('⚠️ TaskOptionsCustomizer already initialized');
        return taskOptionsCustomizer;
    }

    taskOptionsCustomizer = new TaskOptionsCustomizer();

    // Setup event listeners for settings button
    taskOptionsCustomizer.setupEventListeners();

    // Phase 3 - No window.* exports (main script handles exposure)
    return taskOptionsCustomizer;
}

export { taskOptionsCustomizer };

// DI-pure module (no window.* fallbacks)
console.log('✅ TaskOptionsCustomizer module loaded (DI-pure, no window.* exports)');
