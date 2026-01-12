/**
 * Preferences Manager (DI-Pure)
 *
 * Handles the task list color customization preferences modal.
 * Custom colors only apply when the default theme is active.
 *
 * Features:
 * - Color picker inputs for task list elements
 * - Live preview of color changes
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
    taskListBg: '#ffffff',
    taskBg: '#ffffff',
    taskText: '#333333',
    titleBg: '#ffffff',
    titleText: '#2b2b2b'
};

// Map input IDs to settings keys and CSS properties
const COLOR_MAP = {
    'pref-task-list-bg': {
        key: 'taskListBg',
        cssVar: '--pref-task-list-bg',
        selector: '.task-list-container'
    },
    'pref-task-bg': {
        key: 'taskBg',
        cssVar: '--pref-task-bg',
        selector: '.task'
    },
    'pref-task-text': {
        key: 'taskText',
        cssVar: '--pref-task-text',
        selector: '.task'
    },
    'pref-title-bg': {
        key: 'titleBg',
        cssVar: '--pref-title-bg',
        selector: '.mini-cycle-title'
    },
    'pref-title-text': {
        key: 'titleText',
        cssVar: '--pref-title-text',
        selector: '.mini-cycle-title'
    }
};

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('PreferencesManager', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
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
        // Watch for theme class changes on body
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Theme has changed, reapply custom colors (or remove them)
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
    }

    /**
     * Open the preferences modal
     */
    openModal() {
        if (this.modal) {
            // Close main menu first
            _deps.hideMainMenu?.();

            // Update the theme notice based on current theme
            this.updateThemeNotice();

            // Load current saved colors
            this.loadSavedColors();

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
    }

    /**
     * Handle color input change
     * @param {string} inputId - The input element ID
     * @param {string} color - The new color value
     */
    handleColorChange(inputId, color) {
        const config = COLOR_MAP[inputId];
        if (!config) return;

        // Save to appState
        this.saveColor(config.key, color);

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

        const defaultColor = DEFAULT_COLORS[config.key];
        const input = this.colorInputs[inputId];
        if (input) {
            input.value = defaultColor;
        }

        // Save null to indicate default
        this.saveColor(config.key, null);

        // Apply changes
        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        _deps.showNotification?.('Color reset to default', 'info', 2000);
    }

    /**
     * Reset all colors to defaults
     */
    resetAllColors() {
        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const input = this.colorInputs[inputId];
            if (input) {
                input.value = DEFAULT_COLORS[config.key];
            }
        });

        // Clear all custom colors in appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                state.settings.customColors = {
                    taskListBg: null,
                    taskBg: null,
                    taskText: null,
                    titleBg: null,
                    titleText: null
                };
            });
        }

        // Apply changes
        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        _deps.showNotification?.('All colors reset to defaults', 'success', 2000);
    }

    /**
     * Apply custom colors to the task list (only in default theme)
     * Sets CSS custom properties that the CSS rules will use
     */
    applyCustomColors() {
        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};
        const root = document.documentElement;

        // Only apply in default theme, otherwise remove
        if (!this.isDefaultTheme()) {
            this.removeCustomColors();
            return;
        }

        // Set CSS custom properties - the CSS rules handle applying them
        if (customColors.taskListBg) {
            root.style.setProperty('--pref-task-list-bg', customColors.taskListBg);
        } else {
            root.style.removeProperty('--pref-task-list-bg');
        }

        if (customColors.taskBg) {
            root.style.setProperty('--pref-task-bg', customColors.taskBg);
        } else {
            root.style.removeProperty('--pref-task-bg');
        }

        if (customColors.taskText) {
            root.style.setProperty('--pref-task-text', customColors.taskText);
        } else {
            root.style.removeProperty('--pref-task-text');
        }

        if (customColors.titleBg) {
            root.style.setProperty('--pref-title-bg', customColors.titleBg);
        } else {
            root.style.removeProperty('--pref-title-bg');
        }

        if (customColors.titleText) {
            root.style.setProperty('--pref-title-text', customColors.titleText);
        } else {
            root.style.removeProperty('--pref-title-text');
        }
    }

    /**
     * Remove all custom color overrides
     */
    removeCustomColors() {
        const root = document.documentElement;

        // Remove all custom color CSS variables
        root.style.removeProperty('--pref-task-list-bg');
        root.style.removeProperty('--pref-task-bg');
        root.style.removeProperty('--pref-task-text');
        root.style.removeProperty('--pref-title-bg');
        root.style.removeProperty('--pref-title-text');
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
