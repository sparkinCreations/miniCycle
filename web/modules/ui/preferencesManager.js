/**
 * Preferences Manager (DI-Pure)
 *
 * Handles the task list color customization preferences modal.
 * Custom colors only apply when the default theme is active.
 *
 * Features:
 * - Color picker inputs for task list elements
 * - Live preview of color changes
 * - Collapsible sections for organization
 * - Quick preset themes (built-in)
 * - Save/Load/Export/Import custom presets
 * - Undo last color change
 * - Reset to defaults functionality
 * - Saves preferences to appState
 * - Only applies colors in default theme
 *
 * @module ui/preferencesManager
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// DEFAULT COLORS
// ============================================================================

const DEFAULT_COLORS = {
    appBg: '#4c79ff',
    taskListBg: '#ffffff',
    taskBg: '#ffffff',
    taskText: '#333333',
    titleBg: '#ffffff',
    titleText: '#2b2b2b',
    checkboxBg: '#5db567',
    checkboxIncompleteBg: '#c8c8c8',
    checkmark: '#124609',
    completeBtn: '#08c352',
    clearBtn: '#3b82f6',
    progressBar: '#82db8c',
    statsBg: '#ffffff',
    statsText: '#333333'
};

// ============================================================================
// QUICK PRESET THEMES (Built-in)
// ============================================================================

const QUICK_PRESETS = {
    default: {
        name: 'Default',
        colors: { ...DEFAULT_COLORS }
    },
    warm: {
        name: 'Warm',
        colors: {
            appBg: '#ff6b6b',
            taskListBg: '#fff9e6',
            taskBg: '#ffffff',
            taskText: '#5c4033',
            titleBg: '#ffeaa7',
            titleText: '#a85a32',
            checkboxBg: '#e17055',
            checkboxIncompleteBg: '#e8d5c4',
            checkmark: '#ffffff',
            completeBtn: '#fd79a8',
            clearBtn: '#fdcb6e',
            progressBar: '#f8b739',
            statsBg: '#fff9e6',
            statsText: '#5c4033'
        }
    },
    cool: {
        name: 'Cool',
        colors: {
            appBg: '#74b9ff',
            taskListBg: '#e8f8f5',
            taskBg: '#ffffff',
            taskText: '#2c3e50',
            titleBg: '#dfe6e9',
            titleText: '#2980b9',
            checkboxBg: '#0984e3',
            checkboxIncompleteBg: '#b8d4e3',
            checkmark: '#ffffff',
            completeBtn: '#00cec9',
            clearBtn: '#6c5ce7',
            progressBar: '#81ecec',
            statsBg: '#e8f8f5',
            statsText: '#2c3e50'
        }
    },
    forest: {
        name: 'Forest',
        colors: {
            appBg: '#2d5016',
            taskListBg: '#d4edda',
            taskBg: '#e8f5e9',
            taskText: '#1b4332',
            titleBg: '#a8d5ba',
            titleText: '#1b4332',
            checkboxBg: '#2e7d32',
            checkboxIncompleteBg: '#a8c5a8',
            checkmark: '#ffffff',
            completeBtn: '#388e3c',
            clearBtn: '#558b2f',
            progressBar: '#66bb6a',
            statsBg: '#d4edda',
            statsText: '#1b4332'
        }
    },
    monochrome: {
        name: 'Monochrome',
        colors: {
            appBg: '#2d3436',
            taskListBg: '#dfe6e9',
            taskBg: '#ffffff',
            taskText: '#2d3436',
            titleBg: '#b2bec3',
            titleText: '#2d3436',
            checkboxBg: '#636e72',
            checkboxIncompleteBg: '#b2bec3',
            checkmark: '#ffffff',
            completeBtn: '#2d3436',
            clearBtn: '#636e72',
            progressBar: '#95a5a6',
            statsBg: '#dfe6e9',
            statsText: '#2d3436'
        }
    },
    professional: {
        name: 'Professional',
        colors: {
            appBg: '#f5f5f7',
            taskListBg: '#ffffff',
            taskBg: '#ffffff',
            taskText: '#1d1d1f',
            titleBg: '#ffffff',
            titleText: '#1d1d1f',
            checkboxBg: '#007aff',
            checkboxIncompleteBg: '#d1d1d6',
            checkmark: '#ffffff',
            completeBtn: '#34c759',
            clearBtn: '#007aff',
            progressBar: '#007aff',
            statsBg: '#ffffff',
            statsText: '#1d1d1f'
        }
    },
    goldenGlow: {
        name: 'Golden Glow',
        colors: {
            appBg: '#d4a017',
            taskListBg: '#fffef5',
            taskBg: '#fffff8',
            taskText: '#5c4a1f',
            titleBg: '#ffeeba',
            titleText: '#8b6914',
            checkboxBg: '#daa520',
            checkboxIncompleteBg: '#ead9a8',
            checkmark: '#ffffff',
            completeBtn: '#c9a227',
            clearBtn: '#e6b800',
            progressBar: '#ffd700',
            statsBg: '#fffef5',
            statsText: '#5c4a1f'
        }
    },
    darkOcean: {
        name: 'Dark Ocean',
        colors: {
            appBg: '#0a2540',
            taskListBg: '#1a3a5c',
            taskBg: '#1e4263',
            taskText: '#e0f0ff',
            titleBg: '#0d3156',
            titleText: '#7dd3fc',
            checkboxBg: '#0ea5e9',
            checkboxIncompleteBg: '#2a4a6a',
            checkmark: '#ffffff',
            completeBtn: '#06b6d4',
            clearBtn: '#38bdf8',
            progressBar: '#22d3ee',
            statsBg: '#1a3a5c',
            statsText: '#e0f0ff'
        }
    },
    berry: {
        name: 'Berry',
        colors: {
            appBg: '#7c3aed',
            taskListBg: '#faf5ff',
            taskBg: '#ffffff',
            taskText: '#4c1d95',
            titleBg: '#ede9fe',
            titleText: '#6d28d9',
            checkboxBg: '#8b5cf6',
            checkboxIncompleteBg: '#c4b5fd',
            checkmark: '#ffffff',
            completeBtn: '#a855f7',
            clearBtn: '#7c3aed',
            progressBar: '#c084fc',
            statsBg: '#faf5ff',
            statsText: '#4c1d95'
        }
    }
};

// Map input IDs to settings keys and CSS properties
const COLOR_MAP = {
    'pref-app-bg': {
        key: 'appBg',
        cssVar: '--pref-app-bg',
        previewVar: '--preview-app-bg'
    },
    'pref-task-list-bg': {
        key: 'taskListBg',
        cssVar: '--pref-task-list-bg',
        previewVar: '--preview-task-list-bg'
    },
    'pref-task-bg': {
        key: 'taskBg',
        cssVar: '--pref-task-bg',
        previewVar: '--preview-task-bg'
    },
    'pref-task-text': {
        key: 'taskText',
        cssVar: '--pref-task-text',
        previewVar: '--preview-task-text'
    },
    'pref-title-bg': {
        key: 'titleBg',
        cssVar: '--pref-title-bg',
        previewVar: '--preview-title-bg'
    },
    'pref-title-text': {
        key: 'titleText',
        cssVar: '--pref-title-text',
        previewVar: '--preview-title-text'
    },
    'pref-checkbox-bg': {
        key: 'checkboxBg',
        cssVar: '--pref-checkbox-bg',
        previewVar: '--preview-checkbox-bg'
    },
    'pref-checkbox-incomplete-bg': {
        key: 'checkboxIncompleteBg',
        cssVar: '--pref-checkbox-incomplete-bg',
        previewVar: '--preview-checkbox-incomplete-bg'
    },
    'pref-checkmark': {
        key: 'checkmark',
        cssVar: '--pref-checkmark',
        previewVar: '--preview-checkmark'
    },
    'pref-complete-btn': {
        key: 'completeBtn',
        cssVar: '--pref-complete-btn',
        previewVar: '--preview-complete-btn'
    },
    'pref-clear-btn': {
        key: 'clearBtn',
        cssVar: '--pref-clear-btn',
        previewVar: '--preview-clear-btn'
    },
    'pref-progress-bar': {
        key: 'progressBar',
        cssVar: '--pref-progress-bar',
        previewVar: '--preview-progress-bar'
    },
    'pref-stats-bg': {
        key: 'statsBg',
        cssVar: '--pref-stats-bg',
        previewVar: '--preview-stats-bg'
    },
    'pref-stats-text': {
        key: 'statsText',
        cssVar: '--pref-stats-text',
        previewVar: '--preview-stats-text'
    }
};

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('PreferencesManager', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    showPromptModal: optional(null),
    showConfirmationModal: optional(null),
    safeAddEventListener: optional(null),
    hideMainMenu: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for PreferencesManager
 * @param {Object} dependencies - Injected dependencies
 */
export function setPreferencesManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('🎨 PreferencesManager dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// PREFERENCES MANAGER CLASS
// ============================================================================

export class PreferencesManager {
    constructor() {
        this._initialized = false;
        this.modal = null;
        this.colorInputs = {};
        this.undoStack = [];
        this.maxUndoSteps = 20;
    }

    /**
     * Initialize the preferences manager
     */
    async init() {
        if (this._initialized) return;

        await _deps.appInit?.waitForCore();

        try {
            this.modal = document.getElementById('preferences-modal');
            if (!this.modal) {
                console.warn('⚠️ Preferences modal not found');
                return;
            }

            this.setupEventListeners();
            this.loadSavedColors();
            this.applyCustomColors();
            this.setupThemeObserver();
            this.updatePreview();

            this._initialized = true;
            console.log('🎨 PreferencesManager initialized');
        } catch (error) {
            console.warn('⚠️ PreferencesManager initialization failed:', error);
        }
    }

    /**
     * Setup MutationObserver to watch for theme class changes
     */
    setupThemeObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.applyCustomColors();
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        this._themeObserver = observer;
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        const safeAdd = _deps.safeAddEventListener;
        if (!safeAdd) {
            console.warn('⚠️ safeAddEventListener not available');
            return;
        }

        // Open preferences button
        const openBtn = document.getElementById('open-preferences');
        if (openBtn) {
            openBtn._clickHandler = () => this.openModal();
            safeAdd(openBtn, 'click', openBtn._clickHandler);
        }

        // Close button
        const closeBtn = document.getElementById('close-preferences-btn');
        if (closeBtn) {
            closeBtn._clickHandler = () => this.closeModal();
            safeAdd(closeBtn, 'click', closeBtn._clickHandler);
        }

        // Click outside to close
        if (this.modal) {
            this.modal._backdropClickHandler = (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            };
            safeAdd(this.modal, 'click', this.modal._backdropClickHandler);
        }

        // Open themes button
        const openThemesBtn = document.getElementById('preferences-open-themes');
        if (openThemesBtn) {
            openThemesBtn._clickHandler = () => {
                this.closeModal();
                const themesModal = document.getElementById('themes-modal');
                if (themesModal) {
                    themesModal.style.display = 'flex';
                }
            };
            safeAdd(openThemesBtn, 'click', openThemesBtn._clickHandler);
        }

        // Color inputs
        Object.keys(COLOR_MAP).forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                this.colorInputs[inputId] = input;
                input._changeHandler = (e) => this.handleColorChange(inputId, e.target.value);
                safeAdd(input, 'input', input._changeHandler);
            }
        });

        // Checkbox fill visibility toggle
        const checkboxFillToggle = document.getElementById('toggle-checkbox-fill');
        if (checkboxFillToggle) {
            checkboxFillToggle._changeHandler = (e) => this.handleCheckboxFillToggle(e.target.checked);
            safeAdd(checkboxFillToggle, 'change', checkboxFillToggle._changeHandler);

            const toggleSwitch = checkboxFillToggle.closest('.toggle-switch');
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== checkboxFillToggle) {
                        checkboxFillToggle.checked = !checkboxFillToggle.checked;
                        this.handleCheckboxFillToggle(checkboxFillToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Checkbox incomplete visibility toggle
        const checkboxIncompleteToggle = document.getElementById('toggle-checkbox-incomplete');
        if (checkboxIncompleteToggle) {
            checkboxIncompleteToggle._changeHandler = (e) => this.handleCheckboxIncompleteToggle(e.target.checked);
            safeAdd(checkboxIncompleteToggle, 'change', checkboxIncompleteToggle._changeHandler);

            const toggleSwitch = checkboxIncompleteToggle.closest('.toggle-switch');
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== checkboxIncompleteToggle) {
                        checkboxIncompleteToggle.checked = !checkboxIncompleteToggle.checked;
                        this.handleCheckboxIncompleteToggle(checkboxIncompleteToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Reset buttons
        document.querySelectorAll('.preferences-reset-btn').forEach(btn => {
            const targetId = btn.dataset.target;
            if (targetId) {
                btn._clickHandler = () => this.resetColor(targetId);
                safeAdd(btn, 'click', btn._clickHandler);
            }
        });

        // Reset all button
        const resetAllBtn = document.getElementById('preferences-reset-all');
        if (resetAllBtn) {
            resetAllBtn._clickHandler = () => this.resetAllColors();
            safeAdd(resetAllBtn, 'click', resetAllBtn._clickHandler);
        }

        // Save preset button
        const savePresetBtn = document.getElementById('pref-save-preset');
        if (savePresetBtn) {
            savePresetBtn._clickHandler = () => this.promptSavePreset();
            safeAdd(savePresetBtn, 'click', savePresetBtn._clickHandler);
        }

        // Import preset button
        const importPresetBtn = document.getElementById('pref-import-preset');
        if (importPresetBtn) {
            importPresetBtn._clickHandler = () => this.promptImportPreset();
            safeAdd(importPresetBtn, 'click', importPresetBtn._clickHandler);
        }

        // Undo button
        const undoBtn = document.getElementById('preferences-undo');
        if (undoBtn) {
            undoBtn._clickHandler = () => this.undoLastChange();
            safeAdd(undoBtn, 'click', undoBtn._clickHandler);
        }

        // Quick preset buttons
        document.querySelectorAll('.quick-preset-btn').forEach(btn => {
            const presetKey = btn.dataset.preset;
            if (presetKey) {
                btn._clickHandler = () => this.applyQuickPreset(presetKey);
                safeAdd(btn, 'click', btn._clickHandler);
            }
        });

        // Collapsible sections
        document.querySelectorAll('.preferences-section-header.collapsible').forEach(header => {
            header._clickHandler = () => this.toggleSection(header);
            safeAdd(header, 'click', header._clickHandler);
        });
    }

    /**
     * Open the preferences modal
     */
    openModal() {
        if (this.modal) {
            _deps.hideMainMenu?.();
            this.updateThemeNotice();
            this.loadSavedColors();
            this.loadCollapsedStates();
            this.renderPresetsList();
            this.updatePreview();
            this.updateUndoButton();
            this.modal.style.display = 'flex';
        }
    }

    /**
     * Close the preferences modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    /**
     * Update theme notice visibility based on current theme
     */
    updateThemeNotice() {
        const notice = document.getElementById('preferences-theme-notice');
        if (!notice) return;

        const isDefaultTheme = this.isDefaultTheme();
        notice.style.display = isDefaultTheme ? 'none' : 'flex';
    }

    /**
     * Check if the default theme is active
     * @returns {boolean}
     */
    isDefaultTheme() {
        const body = document.body;
        return !body.classList.contains('theme-dark-ocean') &&
               !body.classList.contains('theme-golden-glow') &&
               !body.classList.contains('dark-mode');
    }

    /**
     * Load saved colors from appState into inputs
     */
    loadSavedColors() {
        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};

        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const input = this.colorInputs[inputId];
            if (input) {
                const savedColor = customColors[config.key];
                input.value = savedColor || DEFAULT_COLORS[config.key];
            }
        });

        // Load checkbox fill visibility toggle state
        const checkboxFillToggle = document.getElementById('toggle-checkbox-fill');
        if (checkboxFillToggle) {
            const showFill = customColors.showCheckboxFill !== false; // Default to true
            checkboxFillToggle.checked = showFill;

            const colorInput = document.getElementById('pref-checkbox-bg');
            const resetBtn = document.querySelector('[data-target="pref-checkbox-bg"]');
            if (colorInput) colorInput.style.opacity = showFill ? '1' : '0.3';
            if (resetBtn) resetBtn.style.opacity = showFill ? '1' : '0.3';
        }

        // Load checkbox incomplete visibility toggle state
        const checkboxIncompleteToggle = document.getElementById('toggle-checkbox-incomplete');
        if (checkboxIncompleteToggle) {
            const showCheckbox = customColors.showCheckboxIncomplete !== false; // Default to true
            checkboxIncompleteToggle.checked = showCheckbox;

            const colorInput = document.getElementById('pref-checkbox-incomplete-bg');
            const resetBtn = document.querySelector('[data-target="pref-checkbox-incomplete-bg"]');
            if (colorInput) colorInput.style.opacity = showCheckbox ? '1' : '0.3';
            if (resetBtn) resetBtn.style.opacity = showCheckbox ? '1' : '0.3';
        }
    }

    /**
     * Handle color input change
     * @param {string} inputId - The input element ID
     * @param {string} color - The new color value
     */
    handleColorChange(inputId, color) {
        const config = COLOR_MAP[inputId];
        if (!config) return;

        // Save current state for undo before changing
        this.pushToUndoStack();

        // Save to appState
        this.saveColor(config.key, color);

        // Update preview immediately
        this.updatePreview();

        // Apply immediately if in default theme
        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
    }

    /**
     * Handle checkbox fill visibility toggle
     * @param {boolean} visible - Whether the checkbox fill should be visible
     */
    handleCheckboxFillToggle(visible) {
        console.log('🎨 Checkbox fill toggle:', visible);

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.showCheckboxFill = visible;
            });
        }

        // Update color input visibility
        const colorInput = document.getElementById('pref-checkbox-bg');
        const resetBtn = document.querySelector('[data-target="pref-checkbox-bg"]');
        if (colorInput) colorInput.style.opacity = visible ? '1' : '0.3';
        if (resetBtn) resetBtn.style.opacity = visible ? '1' : '0.3';

        // Update preview
        this.updatePreview();

        // Apply immediately if in default theme
        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }
    }

    /**
     * Handle checkbox incomplete visibility toggle
     * @param {boolean} visible - Whether the incomplete checkbox should be visible
     */
    handleCheckboxIncompleteToggle(visible) {
        console.log('🎨 Checkbox incomplete toggle:', visible);

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.showCheckboxIncomplete = visible;
            });
        }

        // Update color input visibility
        const colorInput = document.getElementById('pref-checkbox-incomplete-bg');
        const resetBtn = document.querySelector('[data-target="pref-checkbox-incomplete-bg"]');
        if (colorInput) colorInput.style.opacity = visible ? '1' : '0.3';
        if (resetBtn) resetBtn.style.opacity = visible ? '1' : '0.3';

        // Update preview
        this.updatePreview();

        // Apply immediately if in default theme
        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }
    }

    /**
     * Save a color to appState
     * @param {string} key - The color key
     * @param {string} color - The color value
     */
    saveColor(key, color) {
        if (!_deps.AppState) return;

        _deps.AppState.update(state => {
            if (!state.settings.customColors) {
                state.settings.customColors = {};
            }
            state.settings.customColors[key] = color;
        });
    }

    /**
     * Reset a single color to default
     * @param {string} inputId - The input element ID
     */
    resetColor(inputId) {
        const config = COLOR_MAP[inputId];
        if (!config) return;

        this.pushToUndoStack();

        const defaultColor = DEFAULT_COLORS[config.key];
        const input = this.colorInputs[inputId];
        if (input) {
            input.value = defaultColor;
        }

        this.saveColor(config.key, null);
        this.updatePreview();

        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
        _deps.showNotification?.('Color reset to default', 'info', 2000);
    }

    /**
     * Reset all colors to defaults
     */
    resetAllColors() {
        this.pushToUndoStack();

        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const input = this.colorInputs[inputId];
            if (input) {
                input.value = DEFAULT_COLORS[config.key];
            }
        });

        if (_deps.AppState) {
            _deps.AppState.update(state => {
                state.settings.customColors = {
                    appBg: null,
                    taskListBg: null,
                    taskBg: null,
                    taskText: null,
                    titleBg: null,
                    titleText: null,
                    checkboxBg: null,
                    checkmark: null,
                    completeBtn: null,
                    clearBtn: null,
                    progressBar: null,
                    statsBg: null,
                    statsText: null
                };
            });
        }

        this.updatePreview();

        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
        _deps.showNotification?.('All colors reset to defaults', 'success', 2000);
    }

    /**
     * Apply custom colors to the task list (only in default theme)
     */
    applyCustomColors() {
        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};
        const root = document.documentElement;

        if (!this.isDefaultTheme()) {
            this.removeCustomColors();
            return;
        }

        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const color = customColors[config.key];
            if (color) {
                root.style.setProperty(config.cssVar, color);
            } else {
                root.style.removeProperty(config.cssVar);
            }
        });

        // Handle checkbox fill visibility
        const showCheckboxFill = customColors.showCheckboxFill !== false;
        if (!showCheckboxFill) {
            root.style.setProperty('--pref-checkbox-bg', 'transparent');
        }

        // Handle checkbox incomplete visibility
        const showCheckboxIncomplete = customColors.showCheckboxIncomplete !== false;
        if (!showCheckboxIncomplete) {
            root.style.setProperty('--pref-checkbox-incomplete-bg', 'transparent');
        }
    }

    /**
     * Remove all custom color overrides
     */
    removeCustomColors() {
        const root = document.documentElement;
        Object.values(COLOR_MAP).forEach(config => {
            root.style.removeProperty(config.cssVar);
        });
    }

    /**
     * Update the live preview with current colors
     */
    updatePreview() {
        const preview = document.getElementById('preferences-preview');
        if (!preview) return;

        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};

        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const input = this.colorInputs[inputId];
            const color = input?.value || customColors[config.key] || DEFAULT_COLORS[config.key];
            if (config.previewVar) {
                preview.style.setProperty(config.previewVar, color);
            }
        });

        // Handle checkbox fill visibility in preview
        const checkboxFillToggle = document.getElementById('toggle-checkbox-fill');
        const showCheckboxFill = checkboxFillToggle?.checked !== false;
        if (!showCheckboxFill) {
            preview.style.setProperty('--preview-checkbox-bg', 'transparent');
        }

        // Handle checkbox incomplete visibility in preview
        const checkboxIncompleteToggle = document.getElementById('toggle-checkbox-incomplete');
        const showCheckboxIncomplete = checkboxIncompleteToggle?.checked !== false;
        if (!showCheckboxIncomplete) {
            preview.style.setProperty('--preview-checkbox-incomplete-bg', 'transparent');
        }
    }

    /**
     * Toggle a collapsible section
     * @param {HTMLElement} header - The section header element
     */
    toggleSection(header) {
        const section = header.closest('.preferences-section');
        if (section) {
            section.classList.toggle('collapsed');
            this.saveCollapsedStates();
        }
    }

    /**
     * Load collapsed states from appState
     */
    loadCollapsedStates() {
        const state = _deps.AppState?.get();
        const collapsedSections = state?.settings?.preferencesCollapsedSections;

        if (!collapsedSections) return;

        // Apply saved collapsed states
        Object.entries(collapsedSections).forEach(([sectionName, isCollapsed]) => {
            const section = document.querySelector(`.preferences-section[data-section="${sectionName}"]`);
            if (section) {
                if (isCollapsed) {
                    section.classList.add('collapsed');
                } else {
                    section.classList.remove('collapsed');
                }
            }
        });
    }

    /**
     * Save collapsed states to appState
     */
    saveCollapsedStates() {
        if (!_deps.AppState) return;

        const sections = document.querySelectorAll('.preferences-section[data-section]');
        const collapsedSections = {};

        sections.forEach(section => {
            const sectionName = section.dataset.section;
            collapsedSections[sectionName] = section.classList.contains('collapsed');
        });

        _deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.preferencesCollapsedSections = collapsedSections;
        });
    }

    /**
     * Apply a quick preset theme
     * @param {string} presetKey - The preset key
     */
    applyQuickPreset(presetKey) {
        const preset = QUICK_PRESETS[presetKey];
        if (!preset) return;

        // Default preset should behave the same as Reset All
        if (presetKey === 'default') {
            this.resetAllColors();
            return;
        }

        this.pushToUndoStack();

        // Apply preset colors
        Object.entries(preset.colors).forEach(([key, color]) => {
            this.saveColor(key, color);
        });

        // Update inputs
        this.loadSavedColors();
        this.updatePreview();

        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
        _deps.showNotification?.(`Applied "${preset.name}" theme`, 'success', 2000);
    }

    // =========================================================================
    // UNDO FUNCTIONALITY
    // =========================================================================

    /**
     * Push current state to undo stack
     */
    pushToUndoStack() {
        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};
        const snapshot = { ...customColors };

        this.undoStack.push(snapshot);

        // Limit stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
    }

    /**
     * Undo the last color change
     */
    undoLastChange() {
        if (this.undoStack.length === 0) return;

        const previousState = this.undoStack.pop();

        if (_deps.AppState) {
            _deps.AppState.update(state => {
                state.settings.customColors = previousState;
            });
        }

        this.loadSavedColors();
        this.updatePreview();

        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
        _deps.showNotification?.('Undone', 'info', 1500);
    }

    /**
     * Update undo button state
     */
    updateUndoButton() {
        const undoBtn = document.getElementById('preferences-undo');
        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
        }
    }

    // =========================================================================
    // PRESET MANAGEMENT
    // =========================================================================

    /**
     * Prompt user for preset name and save current colors
     */
    promptSavePreset() {
        if (_deps.showPromptModal) {
            _deps.showPromptModal({
                title: 'Save Preset',
                message: 'Enter a name for this color preset:',
                placeholder: 'My Custom Theme',
                confirmText: 'Save',
                cancelText: 'Cancel',
                required: true,
                callback: (name) => {
                    if (name && name.trim()) {
                        this.savePreset(name.trim());
                    }
                }
            });
        } else {
            // Fallback to native prompt
            const name = prompt('Enter a name for this preset:');
            if (name && name.trim()) {
                this.savePreset(name.trim());
            }
        }
    }

    /**
     * Save current colors as a new preset
     * @param {string} name - Name for the preset
     */
    savePreset(name) {
        if (!_deps.AppState) return;

        const state = _deps.AppState.get();
        const currentColors = { ...state?.settings?.customColors } || {};

        // Create new preset
        const preset = {
            id: Date.now().toString(),
            name: name,
            colors: currentColors,
            createdAt: Date.now()
        };

        _deps.AppState.update(state => {
            if (!state.settings.savedColorPresets) {
                state.settings.savedColorPresets = [];
            }
            state.settings.savedColorPresets.push(preset);
        });

        this.renderPresetsList();
        _deps.showNotification?.(`Preset "${name}" saved`, 'success', 2000);
    }

    /**
     * Load a preset's colors
     * @param {string} presetId - ID of the preset to load
     */
    loadPreset(presetId) {
        if (!_deps.AppState) return;

        const state = _deps.AppState.get();
        const presets = state?.settings?.savedColorPresets || [];
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            _deps.showNotification?.('Preset not found', 'error', 2000);
            return;
        }

        this.pushToUndoStack();

        _deps.AppState.update(state => {
            state.settings.customColors = { ...preset.colors };
        });

        this.loadSavedColors();
        this.updatePreview();
        this.applyCustomColors();
        this.updateUndoButton();

        _deps.showNotification?.(`Loaded "${preset.name}"`, 'success', 2000);
    }

    /**
     * Rename a preset
     * @param {string} presetId - ID of the preset to rename
     * @param {string} newName - New name for the preset
     */
    renamePreset(presetId, newName) {
        if (!_deps.AppState || !newName.trim()) return;

        _deps.AppState.update(state => {
            const presets = state.settings.savedColorPresets || [];
            const preset = presets.find(p => p.id === presetId);
            if (preset) {
                preset.name = newName.trim();
            }
        });

        this.renderPresetsList();
        _deps.showNotification?.('Preset renamed', 'success', 2000);
    }

    /**
     * Delete a preset
     * @param {string} presetId - ID of the preset to delete
     */
    deletePreset(presetId) {
        if (!_deps.AppState) return;

        const state = _deps.AppState.get();
        const presets = state?.settings?.savedColorPresets || [];
        const preset = presets.find(p => p.id === presetId);

        if (!preset) return;

        const doDelete = () => {
            _deps.AppState.update(state => {
                state.settings.savedColorPresets = (state.settings.savedColorPresets || [])
                    .filter(p => p.id !== presetId);
            });

            this.renderPresetsList();
            _deps.showNotification?.('Preset deleted', 'info', 2000);
        };

        if (_deps.showConfirmationModal) {
            _deps.showConfirmationModal({
                title: 'Delete Preset',
                message: `Are you sure you want to delete "${preset.name}"?`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                callback: (confirmed) => {
                    if (confirmed) {
                        doDelete();
                    }
                }
            });
        } else {
            // Fallback to native confirm
            if (confirm(`Delete preset "${preset.name}"?`)) {
                doDelete();
            }
        }
    }

    /**
     * Export a preset as a shareable code
     * @param {string} presetId - ID of the preset to export
     */
    exportPreset(presetId) {
        const state = _deps.AppState?.get();
        const presets = state?.settings?.savedColorPresets || [];
        const preset = presets.find(p => p.id === presetId);

        if (!preset) return;

        const exportData = {
            name: preset.name,
            colors: preset.colors,
            version: 1
        };

        const code = btoa(JSON.stringify(exportData));

        // Try to copy to clipboard
        navigator.clipboard.writeText(code).then(() => {
            _deps.showNotification?.('Preset code copied to clipboard!', 'success', 3000);
        }).catch(() => {
            // Fallback: show code in a modal for manual copying
            if (_deps.showPromptModal) {
                _deps.showPromptModal({
                    title: 'Export Preset',
                    message: 'Copy this code to share your preset:',
                    defaultValue: code,
                    confirmText: 'Done',
                    cancelText: 'Close',
                    callback: () => {}
                });
            } else {
                prompt('Copy this preset code:', code);
            }
        });
    }

    /**
     * Prompt user to import a preset from code
     */
    promptImportPreset() {
        if (_deps.showPromptModal) {
            _deps.showPromptModal({
                title: 'Import Preset',
                message: 'Paste the preset code you received:',
                placeholder: 'Paste code here...',
                confirmText: 'Import',
                cancelText: 'Cancel',
                required: true,
                callback: (code) => {
                    if (code && code.trim()) {
                        this.importPreset(code.trim());
                    }
                }
            });
        } else {
            // Fallback to native prompt
            const code = prompt('Paste the preset code:');
            if (code && code.trim()) {
                this.importPreset(code.trim());
            }
        }
    }

    /**
     * Import a preset from a code string
     * @param {string} code - The preset code
     */
    importPreset(code) {
        try {
            const data = JSON.parse(atob(code));

            if (!data.name || !data.colors) {
                throw new Error('Invalid preset format');
            }

            // Save as new preset
            if (!_deps.AppState) return;

            const preset = {
                id: Date.now().toString(),
                name: data.name + ' (imported)',
                colors: data.colors,
                createdAt: Date.now()
            };

            _deps.AppState.update(state => {
                if (!state.settings.savedColorPresets) {
                    state.settings.savedColorPresets = [];
                }
                state.settings.savedColorPresets.push(preset);
            });

            this.renderPresetsList();
            _deps.showNotification?.(`Imported "${data.name}"`, 'success', 2000);

        } catch (error) {
            _deps.showNotification?.('Invalid preset code', 'error', 2000);
        }
    }

    /**
     * Render the saved presets list in the UI
     */
    renderPresetsList() {
        const listContainer = document.getElementById('preferences-presets-list');
        const noPresetsMsg = document.getElementById('preferences-no-presets');

        if (!listContainer) return;

        const state = _deps.AppState?.get();
        const presets = state?.settings?.savedColorPresets || [];

        // Clear existing items
        const existingItems = listContainer.querySelectorAll('.preferences-preset-item');
        existingItems.forEach(item => item.remove());

        // Show/hide no presets message
        if (noPresetsMsg) {
            noPresetsMsg.style.display = presets.length === 0 ? 'block' : 'none';
        }

        // Create preset items
        presets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'preferences-preset-item';
            item.dataset.presetId = preset.id;

            // Create color swatch
            const swatchHtml = this.createPresetSwatch(preset.colors);

            item.innerHTML = `
                ${swatchHtml}
                <span class="preferences-preset-name" title="Click to rename">${this.escapeHtml(preset.name)}</span>
                <div class="preferences-preset-actions">
                    <button class="preferences-preset-btn load-btn" title="Load this preset">Load</button>
                    <button class="preferences-preset-btn export-btn" title="Export as code">Export</button>
                    <button class="preferences-preset-btn delete-btn" title="Delete this preset">Del</button>
                </div>
            `;

            // Add event listeners
            const nameSpan = item.querySelector('.preferences-preset-name');
            const loadBtn = item.querySelector('.load-btn');
            const exportBtn = item.querySelector('.export-btn');
            const deleteBtn = item.querySelector('.delete-btn');

            nameSpan.addEventListener('click', () => this.startRenamePreset(preset.id, nameSpan));
            loadBtn.addEventListener('click', () => this.loadPreset(preset.id));
            exportBtn.addEventListener('click', () => this.exportPreset(preset.id));
            deleteBtn.addEventListener('click', () => this.deletePreset(preset.id));

            listContainer.appendChild(item);
        });
    }

    /**
     * Create color swatch HTML for a preset
     * @param {Object} colors - The preset colors
     * @returns {string} HTML string for the swatch
     */
    createPresetSwatch(colors) {
        const swatchColors = [
            colors.appBg || DEFAULT_COLORS.appBg,
            colors.taskListBg || DEFAULT_COLORS.taskListBg,
            colors.checkboxBg || DEFAULT_COLORS.checkboxBg,
            colors.completeBtn || DEFAULT_COLORS.completeBtn
        ];

        return `
            <div class="preferences-preset-swatch">
                ${swatchColors.map(color =>
                    `<span class="preferences-preset-swatch-color" style="background: ${color}"></span>`
                ).join('')}
            </div>
        `;
    }

    /**
     * Start inline editing of preset name
     * @param {string} presetId - ID of the preset
     * @param {HTMLElement} nameSpan - The span element to replace with input
     */
    startRenamePreset(presetId, nameSpan) {
        const currentName = nameSpan.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'preferences-preset-name-input';
        input.value = currentName;

        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const finishEdit = () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                this.renamePreset(presetId, newName);
            } else {
                this.renderPresetsList();
            }
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                this.renderPresetsList();
            }
        });
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const preferencesManager = new PreferencesManager();

/**
 * Initialize PreferencesManager
 * @param {Object} dependencies - Injected dependencies
 * @returns {PreferencesManager} The singleton instance
 */
export async function initPreferencesManager(dependencies = {}) {
    setPreferencesManagerDependencies(dependencies);
    await preferencesManager.init();
    return preferencesManager;
}

/**
 * Apply custom colors (call after theme changes)
 */
export function applyCustomColors() {
    preferencesManager.applyCustomColors();
}

/**
 * Remove custom colors (call when switching to non-default theme)
 */
export function removeCustomColors() {
    preferencesManager.removeCustomColors();
}

export { preferencesManager };
