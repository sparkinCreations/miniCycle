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
 * Sub-modules (loaded dynamically with cache-busting):
 * - preferencesBgImage.js: Background image upload, compression, IndexedDB storage
 * - preferencesPresets.js: Quick presets and custom preset CRUD
 *
 * @module ui/preferencesManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { updateThemeColor } from '../features/themeManager.js';

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
    statsText: '#333333',
    patternColor: '#ffffff'
};

// Default pattern color (white with 12% opacity)
const DEFAULT_PATTERN_COLOR = '#ffffff';
const DEFAULT_PATTERN_OPACITY = 0.12;

/**
 * Generate the background pattern SVG with a custom color
 * @param {string} hexColor - Hex color (e.g., "#ffffff")
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} - Data URL for the SVG pattern
 */
function generatePatternSvg(hexColor, opacity = DEFAULT_PATTERN_OPACITY) {
    // Convert hex to rgba
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const rgbaColor = `rgba(${r},${g},${b},${opacity})`;

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><g fill='none' stroke='${rgbaColor}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'><g transform='rotate(-12 20 28)'><path d='M15 5 L15 28 L18 32 L21 28 L21 5 L18 2 Z'/><path d='M15 5 L21 5'/><path d='M15.5 7 L20.5 7'/><rect x='15' y='28' width='6' height='2' rx='0.5'/><line x1='18' y1='32' x2='18' y2='35'/><path d='M16 8 L16 26 M18 8 L18 26 M20 8 L20 26' stroke-width='0.5'/></g><g transform='rotate(18 155 22)'><path d='M148 6 C146 6 145 8 145 10 L145 14 C145 18 149 18 149 14 L149 10 C149 8 151 8 151 10 L151 22 C151 26 145 26 145 22 L145 12'/></g><g transform='rotate(-6 95 32)'><rect x='78' y='12' width='28' height='36' rx='2'/><circle cx='82' cy='16' r='1.5'/><circle cx='82' cy='22' r='1.5'/><circle cx='82' cy='28' r='1.5'/><circle cx='82' cy='34' r='1.5'/><circle cx='82' cy='40' r='1.5'/><line x1='86' y1='18' x2='102' y2='18'/><line x1='86' y1='24' x2='102' y2='24'/><line x1='86' y1='30' x2='98' y2='30'/><line x1='86' y1='36' x2='100' y2='36'/><line x1='86' y1='42' x2='94' y2='42'/></g><g transform='rotate(15 175 95)'><path d='M168 70 L168 103 L171 107 L174 103 L174 70 L171 67 Z'/><path d='M168 70 L174 70'/><rect x='168' y='72' width='6' height='4' rx='0.5'/><path d='M167 77 L167 87 M167 82 L165 82' stroke-width='1'/><line x1='171' y1='107' x2='171' y2='111'/></g><g transform='rotate(-18 18 125)'><rect x='8' y='100' width='10' height='32' rx='2'/><rect x='9' y='130' width='8' height='6' rx='1'/><rect x='10' y='132' width='6' height='4'/><path d='M11 104 L11 112 M15 104 L15 112' stroke-width='0.8'/><rect x='8' y='98' width='10' height='3' rx='1'/></g><g transform='rotate(8 90 135)'><path d='M65 115 Q65 112 68 112 L98 112 Q101 112 101 115 L101 145 Q101 148 98 148 L68 148 Q65 148 65 145 Z'/><path d='M65 115 L65 145 Q65 148 68 148' stroke-width='2'/><path d='M68 112 L68 148'/><line x1='72' y1='119' x2='97' y2='119'/><line x1='72' y1='125' x2='97' y2='125'/><line x1='72' y1='131' x2='91' y2='131'/><line x1='72' y1='137' x2='95' y2='137'/></g><g transform='rotate(-8 160 150)'><rect x='148' y='138' width='18' height='18' rx='3'/><rect x='150' y='140' width='14' height='14' rx='2' stroke-width='0.8'/><path d='M153 148 L156 151 L162 143' stroke-width='1.8'/></g><g transform='rotate(5 42 175)'><ellipse cx='42' cy='190' rx='12' ry='3'/><path d='M32 190 L32 173 Q32 168 37 168 L47 168 Q52 168 52 173 L52 190'/><path d='M52 178 Q58 178 58 183 Q58 188 52 186'/><path d='M38 165 Q42 162 46 165' stroke-width='0.8'/><path d='M36 162 Q42 158 48 162' stroke-width='0.8'/><path d='M39 159 Q42 156 45 159' stroke-width='0.8'/></g></g></svg>`;

    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

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
// SUB-MODULE LOADING (Dynamic imports with version cache-busting)
// ============================================================================

// NOTE: preferencesBgImage.js and preferencesPresets.js are loaded as
// sub-modules inside PreferencesManager.init() - do NOT list them in
// moduleManifests.js to avoid duplicate initialization.

let _bgImageModule = null;
let _presetsModule = null;

/**
 * Load sub-modules with version cache-busting
 * @param {string} version - Version string for cache-busting
 */
async function loadPreferencesSubModules(version) {
    if (_bgImageModule) {
        return; // Already loaded
    }

    console.log(`Loading preferencesManager sub-modules with v=${version}...`);

    const [bgImageMod, presetsMod] = await Promise.all([
        import(`./preferencesBgImage.js?v=${version}`),
        import(`./preferencesPresets.js?v=${version}`)
    ]);

    _bgImageModule = bgImageMod;
    _presetsModule = presetsMod;

    console.log('🎨 preferencesManager sub-modules loaded');
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
            // Load sub-modules with version cache-busting
            const version = globalThis.APP_VERSION || 'dev-local';
            await loadPreferencesSubModules(version);

            this.modal = _deps.getModal('preferences');
            if (!this.modal) {
                console.warn('⚠️ Preferences modal not found');
                return;
            }

            this.setupEventListeners();
            this.loadSavedColors();
            this.applyCustomColors();
            this.setupThemeObserver();
            this.updatePreview();
            _bgImageModule.initBgImage(_deps.AppState); // Load saved background image

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

        // Open preferences button (from menu)
        const openBtn = document.getElementById(DOM_IDS.OPEN_PREFERENCES);
        if (openBtn) {
            openBtn._clickHandler = () => this.openModal();
            safeAdd(openBtn, 'click', openBtn._clickHandler);
        }

        // Personalization button (quick access in header)
        const personalizationBtn = document.getElementById(DOM_IDS.PERSONALIZATION_BTN);
        if (personalizationBtn) {
            personalizationBtn._clickHandler = () => this.openModal();
            safeAdd(personalizationBtn, 'click', personalizationBtn._clickHandler);
        }

        // Close button
        const closeBtn = document.getElementById(DOM_IDS.CLOSE_PREFERENCES_BTN);
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
        const openThemesBtn = document.getElementById(DOM_IDS.PREFERENCES_OPEN_THEMES);
        if (openThemesBtn) {
            openThemesBtn._clickHandler = () => {
                this.closeModal();
                const themesModal = _deps.getModal('themes');
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

        // Pattern color input (special handling - generates SVG dynamically)
        const patternColorInput = document.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        if (patternColorInput) {
            this.colorInputs['pref-pattern-color'] = patternColorInput;
            patternColorInput._changeHandler = (e) => this.handlePatternColorChange(e.target.value);
            safeAdd(patternColorInput, 'input', patternColorInput._changeHandler);
        }

        // Checkbox fill visibility toggle
        const checkboxFillToggle = document.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
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
        const checkboxIncompleteToggle = document.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
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

        // Background pattern visibility toggle
        const bgPatternToggle = document.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        if (bgPatternToggle) {
            bgPatternToggle._changeHandler = (e) => this.handleBackgroundPatternToggle(e.target.checked);
            safeAdd(bgPatternToggle, 'change', bgPatternToggle._changeHandler);

            const toggleSwitch = bgPatternToggle.closest('.toggle-switch');
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== bgPatternToggle) {
                        bgPatternToggle.checked = !bgPatternToggle.checked;
                        this.handleBackgroundPatternToggle(bgPatternToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Background image visibility toggle
        const bgImageVisibleToggle = document.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        if (bgImageVisibleToggle) {
            bgImageVisibleToggle._changeHandler = (e) => {
                _bgImageModule.handleBgImageVisibleToggle(e.target.checked, _deps.AppState);
                this.updatePreview();
            };
            safeAdd(bgImageVisibleToggle, 'change', bgImageVisibleToggle._changeHandler);

            const toggleSwitch = bgImageVisibleToggle.closest('.toggle-switch');
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== bgImageVisibleToggle) {
                        bgImageVisibleToggle.checked = !bgImageVisibleToggle.checked;
                        _bgImageModule.handleBgImageVisibleToggle(bgImageVisibleToggle.checked, _deps.AppState);
                        this.updatePreview();
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Reset buttons
        document.querySelectorAll(DOM_SELECTORS.PREFERENCES_RESET_BTN).forEach(btn => {
            const targetId = btn.dataset.target;
            if (targetId) {
                btn._clickHandler = () => this.resetColor(targetId);
                safeAdd(btn, 'click', btn._clickHandler);
            }
        });

        // Reset all button
        const resetAllBtn = document.getElementById(DOM_IDS.PREFERENCES_RESET_ALL);
        if (resetAllBtn) {
            resetAllBtn._clickHandler = () => this.resetAllColors();
            safeAdd(resetAllBtn, 'click', resetAllBtn._clickHandler);
        }

        // Save preset button
        const savePresetBtn = document.getElementById(DOM_IDS.PREF_SAVE_PRESET);
        if (savePresetBtn) {
            savePresetBtn._clickHandler = () => _presetsModule.promptSavePreset(
                { AppState: _deps.AppState, showPromptModal: _deps.showPromptModal, showNotification: _deps.showNotification },
                () => this.renderPresetsList()
            );
            safeAdd(savePresetBtn, 'click', savePresetBtn._clickHandler);
        }

        // Import preset button
        const importPresetBtn = document.getElementById(DOM_IDS.PREF_IMPORT_PRESET);
        if (importPresetBtn) {
            importPresetBtn._clickHandler = () => _presetsModule.promptImportPreset(
                { AppState: _deps.AppState, showPromptModal: _deps.showPromptModal, showNotification: _deps.showNotification },
                () => this.renderPresetsList()
            );
            safeAdd(importPresetBtn, 'click', importPresetBtn._clickHandler);
        }

        // Undo button
        const undoBtn = document.getElementById(DOM_IDS.PREFERENCES_UNDO);
        if (undoBtn) {
            undoBtn._clickHandler = () => this.undoLastChange();
            safeAdd(undoBtn, 'click', undoBtn._clickHandler);
        }

        // Quick preset buttons
        document.querySelectorAll(DOM_SELECTORS.QUICK_PRESET_BTN).forEach(btn => {
            const presetKey = btn.dataset.preset;
            if (presetKey) {
                btn._clickHandler = () => _presetsModule.applyQuickPreset(presetKey, {
                    saveColor: (key, color) => this.saveColor(key, color),
                    resetAllColors: () => this.resetAllColors(),
                    loadSavedColors: () => this.loadSavedColors(),
                    updatePreview: () => this.updatePreview(),
                    applyCustomColors: () => this.applyCustomColors(),
                    pushToUndoStack: () => this.pushToUndoStack(),
                    updateUndoButton: () => this.updateUndoButton(),
                    isDefaultTheme: () => this.isDefaultTheme(),
                    showNotification: _deps.showNotification
                });
                safeAdd(btn, 'click', btn._clickHandler);
            }
        });

        // Background image upload
        const bgImageUploadBtn = document.getElementById(DOM_IDS.BG_IMAGE_UPLOAD_BTN);
        const bgImageUpload = document.getElementById(DOM_IDS.BG_IMAGE_UPLOAD);
        const bgImageRemoveBtn = document.getElementById(DOM_IDS.BG_IMAGE_REMOVE_BTN);
        const bgImageMode = document.getElementById(DOM_IDS.BG_IMAGE_MODE);

        if (bgImageUploadBtn && bgImageUpload) {
            bgImageUploadBtn._clickHandler = () => bgImageUpload.click();
            safeAdd(bgImageUploadBtn, 'click', bgImageUploadBtn._clickHandler);

            bgImageUpload._changeHandler = async (e) => {
                const result = await _bgImageModule.handleBgImageUpload(e, {
                    AppState: _deps.AppState,
                    showNotification: _deps.showNotification
                });
                if (result) {
                    _bgImageModule.updateBgImageUI(result.dataUrl, result.mode, _deps.AppState);
                    this.updatePreview();
                }
            };
            safeAdd(bgImageUpload, 'change', bgImageUpload._changeHandler);
        }

        if (bgImageRemoveBtn) {
            bgImageRemoveBtn._clickHandler = async () => {
                const removed = await _bgImageModule.removeBgImage({ showNotification: _deps.showNotification });
                if (removed) {
                    _bgImageModule.updateBgImageUI(null, 'cover', _deps.AppState);
                    this.updatePreview();
                }
            };
            safeAdd(bgImageRemoveBtn, 'click', bgImageRemoveBtn._clickHandler);
        }

        if (bgImageMode) {
            bgImageMode._changeHandler = (e) => _bgImageModule.handleBgImageModeChange(e.target.value);
            safeAdd(bgImageMode, 'change', bgImageMode._changeHandler);
        }

        // Collapsible sections
        document.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION_HEADER_COLLAPSIBLE).forEach(header => {
            header._clickHandler = () => this.toggleSection(header);
            safeAdd(header, 'click', header._clickHandler);
        });
    }

    /**
     * Open the preferences modal
     */
    async openModal() {
        if (this.modal) {
            _deps.hideMainMenu?.();
            this.updateThemeNotice();
            this.loadSavedColors();
            this.loadCollapsedStates();
            this.renderPresetsList();
            this.updatePreview();
            this.updateUndoButton();

            // Refresh background image UI
            const bgData = await _bgImageModule.loadBgImage();
            _bgImageModule.updateBgImageUI(bgData?.dataUrl || null, bgData?.mode || 'cover', _deps.AppState);

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
        const notice = document.getElementById(DOM_IDS.PREFERENCES_THEME_NOTICE);
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
        const checkboxFillToggle = document.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
        if (checkboxFillToggle) {
            const showFill = customColors.showCheckboxFill !== false; // Default to true
            checkboxFillToggle.checked = showFill;

            const colorInput = document.getElementById(DOM_IDS.PREF_CHECKBOX_BG);
            const resetBtn = document.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_BG}"]`);
            if (colorInput) colorInput.style.opacity = showFill ? '1' : '0.3';
            if (resetBtn) resetBtn.style.opacity = showFill ? '1' : '0.3';
        }

        // Load checkbox incomplete visibility toggle state
        const checkboxIncompleteToggle = document.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
        if (checkboxIncompleteToggle) {
            const showCheckbox = customColors.showCheckboxIncomplete !== false; // Default to true
            checkboxIncompleteToggle.checked = showCheckbox;

            const colorInput = document.getElementById(DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG);
            const resetBtn = document.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG}"]`);
            if (colorInput) colorInput.style.opacity = showCheckbox ? '1' : '0.3';
            if (resetBtn) resetBtn.style.opacity = showCheckbox ? '1' : '0.3';
        }

        // Load background pattern visibility toggle state
        const bgPatternToggle = document.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        if (bgPatternToggle) {
            const showPattern = customColors.showBgPattern !== false; // Default to true
            bgPatternToggle.checked = showPattern;
            // Apply body class immediately
            document.body.classList.toggle('no-bg-pattern', !showPattern);
        }

        // Load background image visibility toggle state
        const bgImageVisibleToggle = document.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        if (bgImageVisibleToggle) {
            const showBgImage = customColors.showBgImage !== false; // Default to true
            bgImageVisibleToggle.checked = showBgImage;
            // Note: The has-bg-image class is handled by applyBgImage based on this setting
        }

        // Load pattern color input
        const patternColorInput = document.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        if (patternColorInput) {
            const savedPatternColor = customColors.patternColor || DEFAULT_COLORS.patternColor;
            patternColorInput.value = savedPatternColor;

            // Apply pattern color if not default and in default theme
            if (savedPatternColor !== DEFAULT_COLORS.patternColor && this.isDefaultTheme()) {
                this.applyPatternColor(savedPatternColor);
            }
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
        const colorInput = document.getElementById(DOM_IDS.PREF_CHECKBOX_BG);
        const resetBtn = document.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_BG}"]`);
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
        const colorInput = document.getElementById(DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG);
        const resetBtn = document.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG}"]`);
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
     * Handle background pattern visibility toggle
     * @param {boolean} visible - Whether the background pattern should be visible
     */
    handleBackgroundPatternToggle(visible) {
        console.log('🎨 Background pattern toggle:', visible);

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.showBgPattern = visible;
            });
        }

        // Toggle body class to show/hide pattern
        document.body.classList.toggle('no-bg-pattern', !visible);

        // Update live preview
        this.updatePreview();
    }

    /**
     * Handle background pattern color change
     * @param {string} color - The hex color value
     */
    handlePatternColorChange(color) {
        console.log('🎨 Pattern color change:', color);

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.patternColor = color;
            });
        }

        // Apply the pattern with the new color (only if in default theme)
        if (this.isDefaultTheme()) {
            this.applyPatternColor(color);
        }

        // Update live preview
        this.updatePreview();
    }

    /**
     * Apply pattern color to the body background
     * @param {string} hexColor - The hex color value
     */
    applyPatternColor(hexColor) {
        const patternUrl = generatePatternSvg(hexColor, DEFAULT_PATTERN_OPACITY);
        document.documentElement.style.setProperty('--custom-pattern-bg', patternUrl);
        document.body.classList.add('custom-pattern');
    }

    /**
     * Remove custom pattern color
     */
    removePatternColor() {
        document.documentElement.style.removeProperty('--custom-pattern-bg');
        document.body.classList.remove('custom-pattern');
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
        // Special handling for pattern color (not in COLOR_MAP)
        if (inputId === 'pref-pattern-color') {
            this.pushToUndoStack();

            const defaultColor = DEFAULT_COLORS.patternColor;
            const input = this.colorInputs[inputId];
            if (input) {
                input.value = defaultColor;
            }

            // Save to appState
            if (_deps.AppState) {
                _deps.AppState.update(state => {
                    if (state.settings.customColors) {
                        delete state.settings.customColors.patternColor;
                    }
                });
            }

            // Remove custom pattern
            this.removePatternColor();
            this.updatePreview();
            this.updateUndoButton();
            _deps.showNotification?.('Pattern color reset to default', 'info', 2000);
            return;
        }

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

        // Update status bar color to match app background
        updateThemeColor();
    }

    /**
     * Remove all custom color overrides
     */
    removeCustomColors() {
        const root = document.documentElement;
        Object.values(COLOR_MAP).forEach(config => {
            root.style.removeProperty(config.cssVar);
        });

        // Update status bar color back to default
        updateThemeColor();
    }

    /**
     * Update the live preview with current colors
     */
    updatePreview() {
        const preview = document.getElementById(DOM_IDS.PREFERENCES_PREVIEW);
        if (!preview) return;

        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};

        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const input = this.colorInputs[inputId];
            // Use saved custom color, or input value if different from black (default for color inputs), or default
            const savedColor = customColors[config.key];
            const inputValue = input?.value;
            const defaultColor = DEFAULT_COLORS[config.key];

            // Prefer saved color, then input value (if not the default black), then our default
            let color;
            if (savedColor) {
                color = savedColor;
            } else if (inputValue && inputValue !== '#000000') {
                color = inputValue;
            } else {
                color = defaultColor;
            }

            if (config.previewVar) {
                preview.style.setProperty(config.previewVar, color);
            }

            // Also update the preview section background when app background changes
            if (config.key === 'appBg') {
                const previewSection = document.querySelector(DOM_SELECTORS.PREFERENCES_PREVIEW_SECTION);
                if (previewSection) {
                    previewSection.style.setProperty('--preview-section-bg', color);
                }
            }
        });

        // Handle checkbox fill visibility in preview
        const checkboxFillToggle = document.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
        const showCheckboxFill = checkboxFillToggle?.checked !== false;
        if (!showCheckboxFill) {
            preview.style.setProperty('--preview-checkbox-bg', 'transparent');
        }

        // Handle checkbox incomplete visibility in preview
        const checkboxIncompleteToggle = document.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
        const showCheckboxIncomplete = checkboxIncompleteToggle?.checked !== false;
        if (!showCheckboxIncomplete) {
            preview.style.setProperty('--preview-checkbox-incomplete-bg', 'transparent');
        }

        // Handle background pattern color in preview
        const bgPatternToggle = document.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        const showPattern = bgPatternToggle?.checked !== false;
        const patternColorInput = document.getElementById(DOM_IDS.PREF_PATTERN_COLOR);

        if (showPattern && patternColorInput) {
            const patternColor = patternColorInput.value || DEFAULT_COLORS.patternColor;
            const patternUrl = generatePatternSvg(patternColor, DEFAULT_PATTERN_OPACITY);
            preview.style.setProperty('--preview-pattern-bg', patternUrl);
        } else {
            preview.style.removeProperty('--preview-pattern-bg');
        }

        // Handle background image in preview
        const bgImageVisibleToggle = document.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        const showBgImage = bgImageVisibleToggle?.checked !== false;
        const bgImagePreview = document.getElementById(DOM_IDS.BG_IMAGE_PREVIEW);

        if (showBgImage && bgImagePreview?.src && bgImagePreview.src !== window.location.href) {
            // Show background image in live preview
            preview.style.setProperty('--preview-bg-image', `url("${bgImagePreview.src}")`);
        } else {
            // Remove background image, fall back to color
            preview.style.removeProperty('--preview-bg-image');
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

        const sections = document.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION_BY_DATA);
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
        const undoBtn = document.getElementById(DOM_IDS.PREFERENCES_UNDO);
        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
        }
    }

    // =========================================================================
    // PRESET DELEGATION (to preferencesPresets sub-module)
    // =========================================================================

    /**
     * Render the saved presets list in the UI
     */
    renderPresetsList() {
        if (!_presetsModule) return;

        _presetsModule.renderPresetsList(
            { AppState: _deps.AppState },
            {
                loadPreset: (presetId) => _presetsModule.loadPreset(presetId, {
                    AppState: _deps.AppState,
                    showNotification: _deps.showNotification
                }, {
                    pushToUndoStack: () => this.pushToUndoStack(),
                    loadSavedColors: () => this.loadSavedColors(),
                    updatePreview: () => this.updatePreview(),
                    applyCustomColors: () => this.applyCustomColors(),
                    updateUndoButton: () => this.updateUndoButton()
                }),
                exportPreset: (presetId) => _presetsModule.exportPreset(presetId, {
                    AppState: _deps.AppState,
                    showNotification: _deps.showNotification,
                    showPromptModal: _deps.showPromptModal
                }),
                deletePreset: (presetId) => _presetsModule.deletePreset(presetId, {
                    AppState: _deps.AppState,
                    showNotification: _deps.showNotification,
                    showConfirmationModal: _deps.showConfirmationModal
                }, () => this.renderPresetsList()),
                startRenamePreset: (presetId, nameSpan) => _presetsModule.startRenamePreset(
                    presetId, nameSpan,
                    { AppState: _deps.AppState, showNotification: _deps.showNotification },
                    (id, newName) => _presetsModule.renamePreset(id, newName, {
                        AppState: _deps.AppState,
                        showNotification: _deps.showNotification
                    }, () => this.renderPresetsList()),
                    () => this.renderPresetsList()
                )
            }
        );
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
