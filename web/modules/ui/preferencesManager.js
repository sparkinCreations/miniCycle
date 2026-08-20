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
import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, DATA_SELECTORS, APP_VERSION, UI_TIMEOUTS, PREFERENCES } from '../core/constants.js';
import { updateThemeColor } from '../features/themeManager.js';
import { getLabel } from '../labels/labelResolver.js';
import { applyHelpWindowVisibility, applyQuickActionsVisibility, loadPanelVisibility, resetPanelVisibility } from './panelVisibilityHelpers.js';
import { handleVerticalArrowNav } from '../utils/keyboardNav.js';
import { toggleSectionExpanded, setSectionExpanded, collapseAllSections, usesExclusiveSections, isCollapseAllClick } from '../utils/collapsibleSections.js';
import { normalizeHex } from '../utils/styleValidators.js';
import { isClickOnNotification } from './modalUtils.js';

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
    statsProgress: '#4c79ff',
    statsDoughnut: '#4caf50',
    patternColor: '#ffffff',
    panelText: '#ffffff',
    resetFlash: '#4caf50',
    celebrationBg: '#4caf4f'
};

// Default pattern color (white with 5% opacity)
const DEFAULT_PATTERN_COLOR = '#ffffff';
const DEFAULT_PATTERN_OPACITY = 0.04;

// Checkmark style options ('fitted' is the default — ✔ sized to fit inside the circle)
const CHECKMARK_DEFAULT = 'fitted';
const CHECKMARK_CLASS_MAP = {
    fitted: 'checkmark-fitted',
    minimal: 'checkmark-minimal',
    circle: 'checkmark-circle',
};

/**
 * Background keys that should preserve translucency when customized.
 * Maps settings key → alpha value to apply over the user's chosen color.
 */
const TRANSLUCENT_BG_ALPHA = {
    statsBg: 0.45,
    taskListBg: 0.15,
    resetFlash: 0.3,
};

/**
 * Convert a hex color to rgba with a given alpha.
 * @param {string} hex - Hex color (e.g., "#ff5e5e")
 * @param {number} alpha - Alpha value (0–1)
 * @returns {string} rgba string
 */
function hexToRgba(hex, alpha) {
    // Normalize FIRST: the fixed slice offsets below assume 6 digits, so a
    // shorthand like '#f00' read `''` for blue and produced
    // `rgba(240, 0, NaN, 0.8)` — an invalid declaration the browser silently
    // drops, leaving the previous value in place rather than the theme default.
    // Returns null so callers can take their own fallback branch.
    const safe = normalizeHex(hex);
    if (!safe) return null;
    const r = parseInt(safe.slice(1, 3), 16);
    const g = parseInt(safe.slice(3, 5), 16);
    const b = parseInt(safe.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate the background pattern SVG with a custom color
 * @param {string} hexColor - Hex color (e.g., "#ffffff")
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} - Data URL for the SVG pattern
 */
function generatePatternSvg(hexColor, opacity = DEFAULT_PATTERN_OPACITY) {
    // Fall back to the default rather than emitting NaN. This sink is WORSE
    // than hexToRgba's when unguarded: the result is a `url("data:image/svg+xml,…")`,
    // which is a perfectly valid CSS value, so setProperty ACCEPTS it and the
    // pattern silently renders with no stroke — nothing is rejected and no
    // fallback branch runs. (Not an injection sink: the SVG is
    // encodeURIComponent'd and the colour sits inside a quoted attribute.)
    const safe = normalizeHex(hexColor) || DEFAULT_COLORS.patternColor;
    const r = parseInt(safe.slice(1, 3), 16);
    const g = parseInt(safe.slice(3, 5), 16);
    const b = parseInt(safe.slice(5, 7), 16);
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
    },
    'pref-stats-progress': {
        key: 'statsProgress',
        cssVar: '--pref-stats-progress',
        previewVar: '--preview-stats-progress'
    },
    'pref-stats-doughnut': {
        key: 'statsDoughnut',
        cssVar: '--pref-stats-doughnut',
        previewVar: '--preview-stats-doughnut'
    },
    'pref-panel-text': {
        key: 'panelText',
        cssVar: '--pref-panel-text',
        previewVar: '--preview-panel-text'
    },
    'pref-reset-flash-color': {
        key: 'resetFlash',
        cssVar: '--pref-reset-flash',
        previewVar: null
    },
    'pref-celebration-color': {
        key: 'celebrationBg',
        cssVar: '--pref-celebration-bg',
        previewVar: null
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
    hideMainMenu: optional(null),
    renderVocabThemes: optional(null),
    showPersonalizationTourNotification: optional(null),
    hasActiveNotifications: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    getBody: optional(() => document.body),
    getRootElement: optional(() => document.documentElement),
    getActiveElement: optional(() => document.activeElement),
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for PreferencesManager
 * @param {Object} dependencies - Injected dependencies
 * @returns {void}
 */
export function setPreferencesManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
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
 * @returns {Promise<void>}
 */
async function loadPreferencesSubModules(version) {
    if (_bgImageModule) {
        return; // Already loaded
    }

    const [bgImageMod, presetsMod] = await Promise.all([
        import(`./preferencesBgImage.js?v=${version}`),
        import(`./preferencesPresets.js?v=${version}`)
    ]);

    _bgImageModule = bgImageMod;
    _presetsModule = presetsMod;

}

// ============================================================================
// PREFERENCES MANAGER CLASS
// ============================================================================

/**
 * Manages the visual preferences modal, including color customization,
 * background image settings, preset management, and vocab theme integration.
 */
export class PreferencesManager {
    constructor() {
        this._initialized = false;
        this.modal = null;
        this.colorInputs = {};
        this.undoStack = [];
        this.maxUndoSteps = PREFERENCES.MAX_UNDO_STEPS;
    }

    /**
     * Initialize the preferences manager
     */
    async init() {
        if (this._initialized) return;

        await _deps.appInit?.waitForCore();

        try {
            // Load sub-modules with version cache-busting
            const version = APP_VERSION;
            await loadPreferencesSubModules(version);

            // Render quick preset buttons from data before binding click handlers
            const quickPresetsGrid = _deps.getElementById(DOM_IDS.PREF_QUICK_PRESETS_GRID);
            _presetsModule.renderQuickPresets(quickPresetsGrid);

            this.modal = _deps.getModal('preferences');
            if (!this.modal) {
                console.warn('⚠️ Preferences modal not found');
                return;
            }

            this.setupEventListeners();
            this.loadSavedColors();
            this.applyCustomColors();
            this.applyCheckmarkStyle();
            this.setupThemeObserver();
            this.updatePreview();
            _bgImageModule.initBgImage(_deps.AppState); // Load saved background image

            this._initialized = true;
        } catch (error) {
            console.warn('⚠️ PreferencesManager initialization failed:', error);
        }
    }

    /**
     * Setup MutationObserver to watch for theme class changes
     */
    setupThemeObserver() {
        // Disconnect previous observer if re-initialized
        if (this._themeObserver) {
            this._themeObserver.disconnect();
        }

        this._themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.applyCustomColors();
                }
            });
        });

        this._themeObserver.observe(_deps.getBody(), {
            attributes: true,
            attributeFilter: ['class']
        });
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
        const openBtn = _deps.getElementById(DOM_IDS.OPEN_PREFERENCES);
        if (openBtn) {
            openBtn._clickHandler = () => this.openModal();
            safeAdd(openBtn, 'click', openBtn._clickHandler);
        }

        // Personalization button (quick access in header)
        const personalizationBtn = _deps.getElementById(DOM_IDS.PERSONALIZATION_BTN);
        if (personalizationBtn) {
            personalizationBtn._clickHandler = () => this.openModal();
            safeAdd(personalizationBtn, 'click', personalizationBtn._clickHandler);
        }

        // Close button
        const closeBtn = _deps.getElementById(DOM_IDS.CLOSE_PREFERENCES_BTN);
        if (closeBtn) {
            closeBtn._clickHandler = () => this.closeModal();
            safeAdd(closeBtn, 'click', closeBtn._clickHandler);
        }

        // Click outside to close
        if (this.modal) {
            this.modal._backdropClickHandler = (e) => {
                if (e.target === this.modal && !isClickOnNotification(e)) {
                    this.closeModal();
                }
            };
            safeAdd(this.modal, 'click', this.modal._backdropClickHandler);

            // Restore focus when dialog closes (including native ESC)
            safeAdd(this.modal, 'close', () => {
                this.modal._previousFocus?.focus({ focusVisible: false });
            });
        }

        // Open themes button
        const openThemesBtn = _deps.getElementById(DOM_IDS.PREFERENCES_OPEN_THEMES);
        if (openThemesBtn) {
            openThemesBtn._clickHandler = () => {
                this.closeModal();
                const themesModal = _deps.getModal('themes');
                if (themesModal) {
                    if (!themesModal.open) themesModal.showModal();
                    _deps.renderVocabThemes?.();
                }
            };
            safeAdd(openThemesBtn, 'click', openThemesBtn._clickHandler);
        }

        // Color inputs
        Object.keys(COLOR_MAP).forEach(inputId => {
            const input = _deps.getElementById(inputId);
            if (input) {
                this.colorInputs[inputId] = input;
                input._changeHandler = (e) => this.handleColorChange(inputId, e.target.value);
                safeAdd(input, 'input', input._changeHandler);
            }
        });

        // Pattern color input (special handling - generates SVG dynamically)
        const patternColorInput = _deps.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        if (patternColorInput) {
            this.colorInputs['pref-pattern-color'] = patternColorInput;
            patternColorInput._changeHandler = (e) => this.handlePatternColorChange(e.target.value);
            safeAdd(patternColorInput, 'input', patternColorInput._changeHandler);
        }

        // Pattern opacity slider
        const patternOpacitySlider = _deps.getElementById(DOM_IDS.PREF_PATTERN_OPACITY);
        if (patternOpacitySlider) {
            const opacityDisplay = _deps.getElementById('pref-pattern-opacity-value');
            patternOpacitySlider._inputHandler = (e) => {
                const percent = parseInt(e.target.value, 10);
                if (opacityDisplay) opacityDisplay.textContent = `${percent}%`;
                e.target.setAttribute('aria-valuetext', `Opacity: ${percent}%`);
                this.handlePatternOpacityChange(percent);
            };
            safeAdd(patternOpacitySlider, 'input', patternOpacitySlider._inputHandler);
        }

        // Checkbox fill visibility toggle
        const checkboxFillToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
        if (checkboxFillToggle) {
            checkboxFillToggle._changeHandler = (e) => this.handleCheckboxFillToggle(e.target.checked);
            safeAdd(checkboxFillToggle, 'change', checkboxFillToggle._changeHandler);

            const toggleSwitch = checkboxFillToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
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
        const checkboxIncompleteToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
        if (checkboxIncompleteToggle) {
            checkboxIncompleteToggle._changeHandler = (e) => this.handleCheckboxIncompleteToggle(e.target.checked);
            safeAdd(checkboxIncompleteToggle, 'change', checkboxIncompleteToggle._changeHandler);

            const toggleSwitch = checkboxIncompleteToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
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
        const bgPatternToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        if (bgPatternToggle) {
            bgPatternToggle._changeHandler = (e) => this.handleBackgroundPatternToggle(e.target.checked);
            safeAdd(bgPatternToggle, 'change', bgPatternToggle._changeHandler);

            const toggleSwitch = bgPatternToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
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

        // Solid list background toggle
        const solidListBgToggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_LIST_BG);
        if (solidListBgToggle) {
            solidListBgToggle._changeHandler = (e) => this.handleSolidBgToggle('solidListBg', e.target.checked);
            safeAdd(solidListBgToggle, 'change', solidListBgToggle._changeHandler);

            const toggleSwitch = solidListBgToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== solidListBgToggle) {
                        solidListBgToggle.checked = !solidListBgToggle.checked;
                        this.handleSolidBgToggle('solidListBg', solidListBgToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Solid stats background toggle
        const solidStatsBgToggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_STATS_BG);
        if (solidStatsBgToggle) {
            solidStatsBgToggle._changeHandler = (e) => this.handleSolidBgToggle('solidStatsBg', e.target.checked);
            safeAdd(solidStatsBgToggle, 'change', solidStatsBgToggle._changeHandler);

            const toggleSwitch = solidStatsBgToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== solidStatsBgToggle) {
                        solidStatsBgToggle.checked = !solidStatsBgToggle.checked;
                        this.handleSolidBgToggle('solidStatsBg', solidStatsBgToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Background image visibility toggle
        const bgImageVisibleToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        if (bgImageVisibleToggle) {
            bgImageVisibleToggle._changeHandler = (e) => {
                _bgImageModule.handleBgImageVisibleToggle(e.target.checked, _deps.AppState);
                this.updatePreview();
            };
            safeAdd(bgImageVisibleToggle, 'change', bgImageVisibleToggle._changeHandler);

            const toggleSwitch = bgImageVisibleToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
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

        // Help window visibility toggle (desktop only)
        const helpWindowToggle = _deps.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
        if (helpWindowToggle) {
            helpWindowToggle._changeHandler = (e) => this.handleHelpWindowToggle(e.target.checked);
            safeAdd(helpWindowToggle, 'change', helpWindowToggle._changeHandler);

            const toggleSwitch = helpWindowToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== helpWindowToggle) {
                        helpWindowToggle.checked = !helpWindowToggle.checked;
                        this.handleHelpWindowToggle(helpWindowToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Quick actions visibility toggle (desktop only)
        const quickActionsToggle = _deps.getElementById(DOM_IDS.TOGGLE_QUICK_ACTIONS);
        if (quickActionsToggle) {
            quickActionsToggle._changeHandler = (e) => this.handleQuickActionsToggle(e.target.checked);
            safeAdd(quickActionsToggle, 'change', quickActionsToggle._changeHandler);

            const toggleSwitch = quickActionsToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== quickActionsToggle) {
                        quickActionsToggle.checked = !quickActionsToggle.checked;
                        this.handleQuickActionsToggle(quickActionsToggle.checked);
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Cycle completion toast select
        const toastSelect = _deps.getElementById(DOM_IDS.PREF_TOAST_SELECT);
        if (toastSelect) {
            toastSelect._changeHandler = (e) => {
                _deps.AppState?.update?.(state => {
                    state.settings.cycleCompletionToast = e.target.value;
                });
            };
            safeAdd(toastSelect, 'change', toastSelect._changeHandler);
        }

        // Disable completion animation toggle
        const disableAnimToggle = _deps.getElementById(DOM_IDS.TOGGLE_COMPLETION_ANIMATION);
        if (disableAnimToggle) {
            disableAnimToggle._changeHandler = (e) => {
                _deps.AppState?.update?.(state => {
                    state.settings.disableCompletionAnimation = e.target.checked;
                });
            };
            safeAdd(disableAnimToggle, 'change', disableAnimToggle._changeHandler);

            const toggleSwitch = disableAnimToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== disableAnimToggle) {
                        disableAnimToggle.checked = !disableAnimToggle.checked;
                        _deps.AppState?.update?.(state => {
                            state.settings.disableCompletionAnimation = disableAnimToggle.checked;
                        });
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Disable completion toast toggle
        const disableToastToggle = _deps.getElementById(DOM_IDS.TOGGLE_COMPLETION_TOAST);
        if (disableToastToggle) {
            disableToastToggle._changeHandler = (e) => {
                _deps.AppState?.update?.(state => {
                    state.settings.disableCompletionToast = e.target.checked;
                });
            };
            safeAdd(disableToastToggle, 'change', disableToastToggle._changeHandler);

            const toggleSwitch = disableToastToggle.closest(DOM_SELECTORS.TOGGLE_SWITCH);
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== disableToastToggle) {
                        disableToastToggle.checked = !disableToastToggle.checked;
                        _deps.AppState?.update?.(state => {
                            state.settings.disableCompletionToast = disableToastToggle.checked;
                        });
                    }
                };
                safeAdd(toggleSwitch, 'click', toggleSwitch._clickHandler);
            }
        }

        // Reset buttons
        _deps.querySelectorAll(DOM_SELECTORS.PREFERENCES_RESET_BTN).forEach(btn => {
            const targetId = btn.dataset.target;
            if (targetId) {
                btn._clickHandler = () => this.resetColor(targetId);
                safeAdd(btn, 'click', btn._clickHandler);
            }
        });

        // Reset all button
        const resetAllBtn = _deps.getElementById(DOM_IDS.PREFERENCES_RESET_ALL);
        if (resetAllBtn) {
            resetAllBtn._clickHandler = () => this.resetAllColors();
            safeAdd(resetAllBtn, 'click', resetAllBtn._clickHandler);
        }

        // Save preset button
        const savePresetBtn = _deps.getElementById(DOM_IDS.PREF_SAVE_PRESET);
        if (savePresetBtn) {
            savePresetBtn._clickHandler = () => _presetsModule.promptSavePreset(
                { AppState: _deps.AppState, showPromptModal: _deps.showPromptModal, showNotification: _deps.showNotification },
                () => this.renderPresetsList()
            );
            safeAdd(savePresetBtn, 'click', savePresetBtn._clickHandler);
        }

        // Import preset button
        const importPresetBtn = _deps.getElementById(DOM_IDS.PREF_IMPORT_PRESET);
        if (importPresetBtn) {
            importPresetBtn._clickHandler = () => _presetsModule.promptImportPreset(
                { AppState: _deps.AppState, showPromptModal: _deps.showPromptModal, showNotification: _deps.showNotification },
                () => this.renderPresetsList()
            );
            safeAdd(importPresetBtn, 'click', importPresetBtn._clickHandler);
        }

        // Undo button
        const undoBtn = _deps.getElementById(DOM_IDS.PREFERENCES_UNDO);
        if (undoBtn) {
            undoBtn._clickHandler = () => this.undoLastChange();
            safeAdd(undoBtn, 'click', undoBtn._clickHandler);
        }

        // Quick preset buttons
        _deps.querySelectorAll(DOM_SELECTORS.QUICK_PRESET_BTN).forEach(btn => {
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
        const bgImageUploadBtn = _deps.getElementById(DOM_IDS.BG_IMAGE_UPLOAD_BTN);
        const bgImageUpload = _deps.getElementById(DOM_IDS.BG_IMAGE_UPLOAD);
        const bgImageRemoveBtn = _deps.getElementById(DOM_IDS.BG_IMAGE_REMOVE_BTN);
        const bgImageMode = _deps.getElementById(DOM_IDS.BG_IMAGE_MODE);

        if (bgImageUploadBtn && bgImageUpload) {
            bgImageUploadBtn._clickHandler = () => bgImageUpload.click();
            safeAdd(bgImageUploadBtn, 'click', bgImageUploadBtn._clickHandler);

            bgImageUpload._changeHandler = async (e) => {
                const result = await _bgImageModule.handleBgImageUpload(e, {
                    AppState: _deps.AppState,
                    showNotification: _deps.showNotification,
                    getElementById: _deps.getElementById
                });
                if (result) {
                    _bgImageModule.updateBgImageUI(result.dataUrl, result.mode, _deps.AppState, { getElementById: _deps.getElementById });
                    this.updatePreview();
                }
            };
            safeAdd(bgImageUpload, 'change', bgImageUpload._changeHandler);
        }

        if (bgImageRemoveBtn) {
            bgImageRemoveBtn._clickHandler = async () => {
                const removed = await _bgImageModule.removeBgImage({ showNotification: _deps.showNotification });
                if (removed) {
                    _bgImageModule.updateBgImageUI(null, 'cover', _deps.AppState, { getElementById: _deps.getElementById });
                    this.updatePreview();
                }
            };
            safeAdd(bgImageRemoveBtn, 'click', bgImageRemoveBtn._clickHandler);
        }

        if (bgImageMode) {
            bgImageMode._changeHandler = (e) => _bgImageModule.handleBgImageModeChange(e.target.value);
            safeAdd(bgImageMode, 'change', bgImageMode._changeHandler);
        }

        // Checkmark style options
        this.initCheckmarkStyleOptions();

        // Collapsible sections
        // Click the modal's own chrome (not a section) to close everything. The
        // live preview is excluded from the sweep for the same reason it is
        // excluded from the accordion — it is not one of the sections you pick.
        const scrollArea = _deps.querySelector(DOM_SELECTORS.PREFERENCES_SCROLL_AREA);
        if (scrollArea) {
            scrollArea._collapseAllClickHandler = (e) => {
                if (!isCollapseAllClick(e, scrollArea, DOM_SELECTORS.PREFERENCES_SECTION)) return;
                if (e.target.closest(DOM_SELECTORS.PREFERENCES_PREVIEW_SECTION)) return;
                collapseAllSections(
                    _deps.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION),
                    DOM_SELECTORS.PREFERENCES_SECTION_HEADER
                );
                this.saveCollapsedStates();
            };
            _deps.safeAddEventListener?.(scrollArea, 'click', scrollArea._collapseAllClickHandler);
        }

        _deps.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION_HEADER_COLLAPSIBLE).forEach(header => {
            header._clickHandler = () => this.toggleSection(header);
            safeAdd(header, 'click', header._clickHandler);
            header._keydownHandler = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleSection(header);
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const section = header.closest(DOM_SELECTORS.PREFERENCES_SECTION);
                    if (!section) return;
                    const isCollapsed = section.classList.contains(DOM_CLASSES.COLLAPSED);
                    if (e.key === 'ArrowRight' && isCollapsed) {
                        e.preventDefault();
                        this.toggleSection(header);
                    } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                        e.preventDefault();
                        this.toggleSection(header);
                    }
                } else if (this.modal && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    handleVerticalArrowNav(e, this.modal, DOM_SELECTORS.PREFERENCES_SECTION_HEADER_COLLAPSIBLE, {
                        wrap: false, skipHidden: true
                    });
                }
            };
            safeAdd(header, 'keydown', header._keydownHandler);
        });
    }

    /**
     * Open the preferences modal
     */
    async openModal() {
        if (!this.modal) return;

        _deps.hideMainMenu?.();
        this.updateThemeNotice();
        this.loadSavedColors();
        this.loadCollapsedStates();
        this.renderPresetsList();
        this.updatePreview();
        this.updateUndoButton();

        // Refresh background image UI
        const bgData = await _bgImageModule.loadBgImage();
        _bgImageModule.updateBgImageUI(bgData?.dataUrl || null, bgData?.mode || 'cover', _deps.AppState, { getElementById: _deps.getElementById });

        this.modal._previousFocus = _deps.getActiveElement();
        if (!this.modal.open) this.modal.showModal();

        // Show tour prompt after modal is open. The notification system's
        // _ensureAboveDialogs() re-shows the popover container so it stacks
        // above the dialog in the top layer, keeping it visible and interactive.
        _deps.showPersonalizationTourNotification?.();
    }

    /**
     * Close the preferences modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.close();
            this.modal._previousFocus?.focus({ focusVisible: false });
        }
    }

    /**
     * Update theme notice visibility and text based on current theme
     */
    updateThemeNotice() {
        const notice = _deps.getElementById(DOM_IDS.PREFERENCES_THEME_NOTICE);
        if (!notice) return;

        const root = _deps.getRootElement();
        const vocabTheme = root.dataset.vocabTheme;
        const isVocabThemeActive = !!vocabTheme && vocabTheme !== 'classic';

        if (isVocabThemeActive) {
            const themeName = root.dataset.vocabThemeName || vocabTheme;
            const textNode = notice.firstChild;
            if (textNode?.nodeType === Node.TEXT_NODE) {
                textNode.textContent = getLabel('prefs.vocabThemeNotice', { vars: { name: themeName } }) + ' ';
            }
            notice.style.display = 'flex';
        } else if (!this.isDefaultTheme()) {
            const textNode = notice.firstChild;
            if (textNode?.nodeType === Node.TEXT_NODE) {
                textNode.textContent = getLabel('prefs.themeNotice') + ' ';
            }
            notice.style.display = 'flex';
        } else {
            notice.style.display = 'none';
        }
    }

    /**
     * Check if the default theme is active (no CSS-class override and no vocab theme)
     * @returns {boolean}
     */
    isDefaultTheme() {
        const body = _deps.getBody();
        const root = _deps.getRootElement();
        return !body.classList.contains(DOM_CLASSES.THEME_DARK_OCEAN) &&
               !body.classList.contains(DOM_CLASSES.THEME_GOLDEN_GLOW) &&
               !body.classList.contains(DOM_CLASSES.DARK_MODE) &&
               (!root.dataset.vocabTheme || root.dataset.vocabTheme === 'classic');
    }

    /**
     * Check if pattern customization is allowed (default theme OR dark mode with classic vocab)
     * Pattern slider works in dark mode unlike other color pickers
     * @returns {boolean}
     */
    isPatternCustomizable() {
        const body = _deps.getBody();
        const root = _deps.getRootElement();
        return !body.classList.contains(DOM_CLASSES.THEME_DARK_OCEAN) &&
               !body.classList.contains(DOM_CLASSES.THEME_GOLDEN_GLOW) &&
               (!root.dataset.vocabTheme || root.dataset.vocabTheme === 'classic');
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
        const checkboxFillToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
        if (checkboxFillToggle) {
            const showFill = customColors.showCheckboxFill !== false; // Default to true
            checkboxFillToggle.checked = showFill;

            const colorInput = _deps.getElementById(DOM_IDS.PREF_CHECKBOX_BG);
            const resetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_BG}"]`);
            if (colorInput) colorInput.style.opacity = showFill ? '1' : '0.3';
            if (resetBtn) resetBtn.style.opacity = showFill ? '1' : '0.3';
        }

        // Load checkbox incomplete visibility toggle state
        const checkboxIncompleteToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
        if (checkboxIncompleteToggle) {
            const showCheckbox = customColors.showCheckboxIncomplete !== false; // Default to true
            checkboxIncompleteToggle.checked = showCheckbox;

            const colorInput = _deps.getElementById(DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG);
            const resetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG}"]`);
            if (colorInput) colorInput.style.opacity = showCheckbox ? '1' : '0.3';
            if (resetBtn) resetBtn.style.opacity = showCheckbox ? '1' : '0.3';
        }

        // Load background pattern visibility toggle state
        const bgPatternToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        if (bgPatternToggle) {
            const showPattern = customColors.showBgPattern !== false; // Default to true
            bgPatternToggle.checked = showPattern;
            // Apply body class immediately
            _deps.getBody().classList.toggle(DOM_CLASSES.NO_BG_PATTERN, !showPattern);
            // Dim pattern controls if pattern is hidden
            this.updatePatternControlsVisibility(showPattern);
        }

        // Load background image visibility toggle state
        const bgImageVisibleToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        if (bgImageVisibleToggle) {
            const showBgImage = customColors.showBgImage !== false; // Default to true
            bgImageVisibleToggle.checked = showBgImage;
            // Note: The has-bg-image class is handled by applyBgImage based on this setting
        }

        // Load panel visibility toggle states (help window + quick actions)
        loadPanelVisibility(customColors);

        // Load solid background toggle states
        const solidListBgToggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_LIST_BG);
        if (solidListBgToggle) {
            solidListBgToggle.checked = customColors.solidListBg === true; // Default false
        }
        const solidStatsBgToggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_STATS_BG);
        if (solidStatsBgToggle) {
            solidStatsBgToggle.checked = customColors.solidStatsBg === true; // Default false
        }

        // Load cycle completion settings
        const settings = state?.settings || {};
        const toastSelect = _deps.getElementById(DOM_IDS.PREF_TOAST_SELECT);
        if (toastSelect) {
            toastSelect.value = settings.cycleCompletionToast || 'default';
        }
        const disableAnimToggle = _deps.getElementById(DOM_IDS.TOGGLE_COMPLETION_ANIMATION);
        if (disableAnimToggle) {
            disableAnimToggle.checked = settings.disableCompletionAnimation === true;
        }
        const disableToastToggle = _deps.getElementById(DOM_IDS.TOGGLE_COMPLETION_TOAST);
        if (disableToastToggle) {
            disableToastToggle.checked = settings.disableCompletionToast === true;
        }

        // Load pattern color input
        const patternColorInput = _deps.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        if (patternColorInput) {
            const savedPatternColor = customColors.patternColor || DEFAULT_COLORS.patternColor;
            patternColorInput.value = savedPatternColor;
        }

        // Load pattern opacity slider
        const patternOpacitySlider = _deps.getElementById(DOM_IDS.PREF_PATTERN_OPACITY);
        if (patternOpacitySlider) {
            const defaultPercent = Math.round(DEFAULT_PATTERN_OPACITY * 100);
            const savedOpacity = customColors.patternOpacity != null
                ? customColors.patternOpacity
                : defaultPercent;
            patternOpacitySlider.value = savedOpacity;
            patternOpacitySlider.setAttribute('aria-valuetext', `Opacity: ${savedOpacity}%`);
            const opacityDisplay = _deps.getElementById('pref-pattern-opacity-value');
            if (opacityDisplay) opacityDisplay.textContent = `${savedOpacity}%`;
        }

        // Apply pattern if color or opacity differs from defaults (works in dark mode too)
        if (this.isPatternCustomizable()) {
            this.applyPatternWithCurrentSettings();
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
        const colorInput = _deps.getElementById(DOM_IDS.PREF_CHECKBOX_BG);
        const resetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_BG}"]`);
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
        const colorInput = _deps.getElementById(DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG);
        const resetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG}"]`);
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
        _deps.getBody().classList.toggle(DOM_CLASSES.NO_BG_PATTERN, !visible);

        // Dim/enable pattern color and opacity controls
        this.updatePatternControlsVisibility(visible);

        // Update live preview
        this.updatePreview();
    }

    /**
     * Handle solid background toggle for list or stats panel
     * @param {string} key - State key ('solidListBg' or 'solidStatsBg')
     * @param {boolean} solid - Whether the background should be solid
     */
    handleSolidBgToggle(key, solid) {
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors[key] = solid;
            });
        }

        // Re-apply colors to update translucency
        this.applyCustomColors();
        this.updatePreview();
    }

    /**
     * Handle help window visibility toggle
     * @param {boolean} visible - Whether the help window should be visible
     */
    handleHelpWindowToggle(visible) {
        applyHelpWindowVisibility(visible, _deps.AppState);
        this.updatePreview();
    }

    /**
     * Handle quick actions visibility toggle
     * @param {boolean} visible - Whether the quick actions panel should be visible
     */
    handleQuickActionsToggle(visible) {
        applyQuickActionsVisibility(visible, _deps.AppState);
        this.updatePreview();
    }

    /**
     * Dim or enable pattern color and opacity controls based on pattern visibility
     * @param {boolean} visible - Whether the pattern is visible
     */
    updatePatternControlsVisibility(visible) {
        const dimOpacity = visible ? '1' : '0.3';
        const colorInput = _deps.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        const colorResetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_PATTERN_COLOR}"]`);
        const opacitySlider = _deps.getElementById(DOM_IDS.PREF_PATTERN_OPACITY);
        const opacityDisplay = _deps.getElementById('pref-pattern-opacity-value');
        const opacityResetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_PATTERN_OPACITY}"]`);

        if (colorInput) colorInput.style.opacity = dimOpacity;
        if (colorResetBtn) colorResetBtn.style.opacity = dimOpacity;
        if (opacitySlider) opacitySlider.style.opacity = dimOpacity;
        if (opacityDisplay) opacityDisplay.style.opacity = dimOpacity;
        if (opacityResetBtn) opacityResetBtn.style.opacity = dimOpacity;
    }

    /**
     * Handle background pattern color change
     * @param {string} color - The hex color value
     */
    handlePatternColorChange(color) {

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.patternColor = color;
            });
        }

        // Apply the pattern with current settings (works in dark mode too)
        if (this.isPatternCustomizable()) {
            this.applyPatternWithCurrentSettings();
        }

        // Update live preview
        this.updatePreview();
    }

    /**
     * Handle background pattern opacity change
     * @param {number} percent - Opacity percentage (1-25)
     */
    handlePatternOpacityChange(percent) {

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.patternOpacity = percent;
            });
        }

        // Apply the pattern with current settings (works in dark mode too)
        if (this.isPatternCustomizable()) {
            this.applyPatternWithCurrentSettings();
        }

        // Update live preview
        this.updatePreview();
    }

    /**
     * Apply pattern with current color and opacity settings.
     * Uses inline SVG generation when color or opacity differs from defaults,
     * falls back to external pattern.svg when both are default.
     */
    applyPatternWithCurrentSettings() {
        const customColors = _deps.AppState?.get()?.settings?.customColors || {};
        const color = customColors.patternColor || DEFAULT_COLORS.patternColor;
        const opacity = customColors.patternOpacity != null
            ? customColors.patternOpacity / 100
            : DEFAULT_PATTERN_OPACITY;

        const isDefaultColor = color === DEFAULT_COLORS.patternColor;
        const isDefaultOpacity = customColors.patternOpacity == null ||
            customColors.patternOpacity === Math.round(DEFAULT_PATTERN_OPACITY * 100);

        if (isDefaultColor && isDefaultOpacity) {
            // Both defaults — use external SVG
            this.removePatternColor();
        } else {
            // Custom color or opacity — generate inline SVG
            const patternUrl = generatePatternSvg(color, opacity);
            _deps.getRootElement().style.setProperty('--custom-pattern-bg', patternUrl);
            _deps.getBody().classList.add(DOM_CLASSES.CUSTOM_PATTERN);
        }
    }

    /**
     * Remove custom pattern (revert to external SVG)
     */
    removePatternColor() {
        _deps.getRootElement().style.removeProperty('--custom-pattern-bg');
        _deps.getBody().classList.remove(DOM_CLASSES.CUSTOM_PATTERN);
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

            // Reapply pattern with current settings (opacity may still be custom)
            this.applyPatternWithCurrentSettings();
            this.updatePreview();
            this.updateUndoButton();
            _deps.showNotification?.(getLabel('notify.patternColorReset'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
            return;
        }

        // Special handling for pattern opacity (not in COLOR_MAP)
        if (inputId === 'pref-pattern-opacity') {
            this.pushToUndoStack();

            const defaultPercent = Math.round(DEFAULT_PATTERN_OPACITY * 100);
            const slider = _deps.getElementById(DOM_IDS.PREF_PATTERN_OPACITY);
            if (slider) {
                slider.value = defaultPercent;
                slider.setAttribute('aria-valuetext', `Opacity: ${defaultPercent}%`);
            }
            const display = _deps.getElementById('pref-pattern-opacity-value');
            if (display) display.textContent = `${defaultPercent}%`;

            // Save to appState
            if (_deps.AppState) {
                _deps.AppState.update(state => {
                    if (state.settings.customColors) {
                        delete state.settings.customColors.patternOpacity;
                    }
                });
            }

            // Reapply pattern with current settings (color may still be custom)
            this.applyPatternWithCurrentSettings();
            this.updatePreview();
            this.updateUndoButton();
            _deps.showNotification?.(getLabel('notify.patternOpacityReset'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
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

        // If resetting a translucent background, also turn off its solid toggle
        if (config.key === 'taskListBg') {
            const toggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_LIST_BG);
            if (toggle) toggle.checked = false;
            if (_deps.AppState) {
                _deps.AppState.update(state => {
                    if (state.settings.customColors) state.settings.customColors.solidListBg = false;
                });
            }
        } else if (config.key === 'statsBg') {
            const toggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_STATS_BG);
            if (toggle) toggle.checked = false;
            if (_deps.AppState) {
                _deps.AppState.update(state => {
                    if (state.settings.customColors) state.settings.customColors.solidStatsBg = false;
                });
            }
        }

        this.updatePreview();

        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
        _deps.showNotification?.(getLabel('notify.colorReset'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    /**
     * Reset all colors to defaults
     */
    resetAllColors() {
        this.pushToUndoStack();

        // Reset all color picker inputs to defaults
        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const input = this.colorInputs[inputId];
            if (input) {
                input.value = DEFAULT_COLORS[config.key];
            }
        });

        // Reset state — nullify all colors, restore toggle defaults
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
                    checkboxIncompleteBg: null,
                    checkmark: null,
                    completeBtn: null,
                    clearBtn: null,
                    progressBar: null,
                    statsBg: null,
                    statsText: null,
                    statsProgress: null,
                    statsDoughnut: null,
                    panelText: null,
                    resetFlash: null,
                    celebrationBg: null,
                    patternColor: null,
                    patternOpacity: null,
                    showCheckboxFill: true,
                    showCheckboxIncomplete: true,
                    showBgPattern: true,
                    showBgImage: false,
                    solidListBg: false,
                    solidStatsBg: false,
                    showHelpWindow: true,
                    showQuickActions: true
                };
            });
        }

        // Reset solid background toggles
        const solidListBgToggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_LIST_BG);
        if (solidListBgToggle) solidListBgToggle.checked = false;
        const solidStatsBgToggle = _deps.getElementById(DOM_IDS.TOGGLE_SOLID_STATS_BG);
        if (solidStatsBgToggle) solidStatsBgToggle.checked = false;

        // Reset panel visibility (both visible, sync all checkboxes)
        resetPanelVisibility();

        // Reset background pattern toggle + body class + controls
        const bgPatternToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        if (bgPatternToggle) bgPatternToggle.checked = true;
        _deps.getBody().classList.remove(DOM_CLASSES.NO_BG_PATTERN);
        this.updatePatternControlsVisibility(true);

        // Reset custom pattern (revert to external SVG)
        this.removePatternColor();

        // Reset pattern opacity slider UI
        const defaultPercent = Math.round(DEFAULT_PATTERN_OPACITY * 100);
        const opacitySlider = _deps.getElementById(DOM_IDS.PREF_PATTERN_OPACITY);
        if (opacitySlider) {
            opacitySlider.value = defaultPercent;
            opacitySlider.setAttribute('aria-valuetext', `Opacity: ${defaultPercent}%`);
        }
        const opacityDisplay = _deps.getElementById('pref-pattern-opacity-value');
        if (opacityDisplay) opacityDisplay.textContent = `${defaultPercent}%`;

        // Reset pattern color input UI
        const patternColorInput = _deps.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        if (patternColorInput) patternColorInput.value = DEFAULT_COLORS.patternColor;

        // Reset checkbox toggles
        const checkboxFillToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
        if (checkboxFillToggle) checkboxFillToggle.checked = true;
        const checkboxFillInput = _deps.getElementById(DOM_IDS.PREF_CHECKBOX_BG);
        const checkboxFillResetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_BG}"]`);
        if (checkboxFillInput) checkboxFillInput.style.opacity = '1';
        if (checkboxFillResetBtn) checkboxFillResetBtn.style.opacity = '1';

        const checkboxIncompleteToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
        if (checkboxIncompleteToggle) checkboxIncompleteToggle.checked = true;
        const checkboxIncompleteInput = _deps.getElementById(DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG);
        const checkboxIncompleteResetBtn = _deps.querySelector(`[data-target="${DOM_IDS.PREF_CHECKBOX_INCOMPLETE_BG}"]`);
        if (checkboxIncompleteInput) checkboxIncompleteInput.style.opacity = '1';
        if (checkboxIncompleteResetBtn) checkboxIncompleteResetBtn.style.opacity = '1';

        // Reset cycle completion settings
        const celebrationColorInput = _deps.getElementById(DOM_IDS.PREF_CELEBRATION_COLOR);
        if (celebrationColorInput) celebrationColorInput.value = '#4caf4f';
        const toastSelect = _deps.getElementById(DOM_IDS.PREF_TOAST_SELECT);
        if (toastSelect) toastSelect.value = 'default';
        const disableAnimToggle = _deps.getElementById(DOM_IDS.TOGGLE_COMPLETION_ANIMATION);
        if (disableAnimToggle) disableAnimToggle.checked = false;
        const disableToastToggle = _deps.getElementById(DOM_IDS.TOGGLE_COMPLETION_TOAST);
        if (disableToastToggle) disableToastToggle.checked = false;

        if (_deps.AppState) {
            _deps.AppState.update(state => {
                state.settings.cycleCompletionToast = 'default';
                state.settings.disableCompletionAnimation = false;
                state.settings.disableCompletionToast = false;
            });
        }

        // Hide background image (keep image data, just toggle off)
        const bgImageVisibleToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        if (bgImageVisibleToggle) bgImageVisibleToggle.checked = false;
        _deps.getBody().classList.remove(DOM_CLASSES.HAS_BG_IMAGE, DOM_CLASSES.BG_MODE_COVER, DOM_CLASSES.BG_MODE_CENTER, DOM_CLASSES.BG_MODE_TILE);

        this.updatePreview();

        if (this.isDefaultTheme()) {
            this.applyCustomColors();
        }

        this.updateUndoButton();
        _deps.showNotification?.(getLabel('notify.allColorsReset'), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    /**
     * Apply custom colors to the task list (only in default theme)
     */
    applyCustomColors() {
        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};
        const root = _deps.getRootElement();

        if (!this.isDefaultTheme()) {
            // Only clear --pref-* vars for CSS-class overrides (dark mode, legacy themes).
            // Vocab themes apply their own --pref-* vars directly — don't clear them.
            const body = _deps.getBody();
            if (body.classList.contains(DOM_CLASSES.DARK_MODE) ||
                body.classList.contains(DOM_CLASSES.THEME_DARK_OCEAN) ||
                body.classList.contains(DOM_CLASSES.THEME_GOLDEN_GLOW)) {
                this.removeCustomColors();
            }
            return;
        }

        // Check solid background toggles to skip alpha conversion
        const solidOverrides = {
            taskListBg: customColors.solidListBg === true,
            statsBg: customColors.solidStatsBg === true,
        };

        Object.entries(COLOR_MAP).forEach(([inputId, config]) => {
            const color = customColors[config.key];
            const alpha = TRANSLUCENT_BG_ALPHA[config.key];
            const useSolid = solidOverrides[config.key];

            // Validate HERE, at the boundary where stored values become styles,
            // rather than trusting every writer. Same reasoning as the
            // settings.priorityColor fix: the <input type="color"> path is safe,
            // but the preset share-code importer gates on isValidHex, which
            // accepts 3-digit shorthand — valid hex that this module's fixed
            // slice offsets could not read. An unusable value now falls through
            // to removeProperty (theme default) instead of writing NaN.
            const safeColor = normalizeHex(color);

            if (safeColor) {
                root.style.setProperty(config.cssVar, (alpha && !useSolid) ? hexToRgba(safeColor, alpha) : safeColor);
            } else if (useSolid && alpha) {
                // No custom color but solid toggle is on — override translucent theme default
                root.style.setProperty(config.cssVar, DEFAULT_COLORS[config.key]);
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
     * Apply checkmark style from settings to body class
     */
    applyCheckmarkStyle() {
        const state = _deps.AppState?.get();
        const style = state?.settings?.checkmarkStyle || CHECKMARK_DEFAULT;
        const body = _deps.getBody();
        if (!body) return;

        // Remove all checkmark style classes
        Object.values(CHECKMARK_CLASS_MAP).forEach(cls => body.classList.remove(cls));

        // Apply selected style class (standard has no class — it uses the base CSS)
        if (CHECKMARK_CLASS_MAP[style]) {
            body.classList.add(CHECKMARK_CLASS_MAP[style]);
        }
    }

    /**
     * Initialize checkmark style dropdown in preferences modal
     */
    initCheckmarkStyleOptions() {
        const select = _deps.getElementById(DOM_IDS.CHECKMARK_STYLE_OPTIONS);
        if (!select || select.tagName !== 'SELECT') return;

        // Apply localised labels to <option> elements (HTML has placeholder text)
        const labelMap = {
            fitted: getLabel('prefs.checkmarkFitted'),
            minimal: getLabel('prefs.checkmarkMinimal'),
            standard: getLabel('prefs.checkmarkLarger'),
            circle: getLabel('prefs.checkmarkNoCheckmark')
        };
        for (const option of select.options) {
            if (labelMap[option.value]) {
                option.textContent = labelMap[option.value];
            }
        }

        const safeAdd = _deps.safeAddEventListener;
        const state = _deps.AppState?.get();
        const currentStyle = state?.settings?.checkmarkStyle || CHECKMARK_DEFAULT;

        // Set initial selected value
        select.value = currentStyle;

        // Bind change handler
        select._changeHandler = () => {
            const style = select.value;

            // Save to AppState
            _deps.AppState?.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.checkmarkStyle = style;
            }, true);

            // Apply CSS class
            this.applyCheckmarkStyle();

            // Notification
            _deps.showNotification?.(
                getLabel('notify.checkmarkStyleChanged'),
                'info',
                UI_TIMEOUTS.NOTIFICATION_SHORT
            );
        };
        if (safeAdd) safeAdd(select, 'change', select._changeHandler);
    }

    /**
     * Remove all custom color overrides
     */
    removeCustomColors() {
        const root = _deps.getRootElement();
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
        const preview = _deps.getElementById(DOM_IDS.PREFERENCES_PREVIEW);
        if (!preview) return;

        const state = _deps.AppState?.get();
        const customColors = state?.settings?.customColors || {};

        // Check solid background toggles for preview
        const solidOverrides = {
            taskListBg: customColors.solidListBg === true,
            statsBg: customColors.solidStatsBg === true,
        };

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

            // Same normalization as the live apply path above — `color` here can
            // come from saved settings, so it carries the same exposure.
            const safePreviewColor = normalizeHex(color) || defaultColor;

            if (config.previewVar) {
                const alpha = TRANSLUCENT_BG_ALPHA[config.key];
                const useSolid = solidOverrides[config.key];
                preview.style.setProperty(config.previewVar, (alpha && !useSolid) ? hexToRgba(safePreviewColor, alpha) : safePreviewColor);
            }

            // Also update the preview section background when app background changes
            if (config.key === 'appBg') {
                const previewSection = _deps.querySelector(DOM_SELECTORS.PREFERENCES_PREVIEW_SECTION);
                if (previewSection) {
                    previewSection.style.setProperty('--preview-section-bg', safePreviewColor);
                }
            }
        });

        // Handle checkbox fill visibility in preview
        const checkboxFillToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_FILL);
        const showCheckboxFill = checkboxFillToggle?.checked !== false;
        if (!showCheckboxFill) {
            preview.style.setProperty('--preview-checkbox-bg', 'transparent');
        }

        // Handle checkbox incomplete visibility in preview
        const checkboxIncompleteToggle = _deps.getElementById(DOM_IDS.TOGGLE_CHECKBOX_INCOMPLETE);
        const showCheckboxIncomplete = checkboxIncompleteToggle?.checked !== false;
        if (!showCheckboxIncomplete) {
            preview.style.setProperty('--preview-checkbox-incomplete-bg', 'transparent');
        }

        // Handle background pattern color and opacity in preview
        const bgPatternToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_PATTERN);
        const showPattern = bgPatternToggle?.checked !== false;
        const patternColorInput = _deps.getElementById(DOM_IDS.PREF_PATTERN_COLOR);
        const patternOpacitySlider = _deps.getElementById(DOM_IDS.PREF_PATTERN_OPACITY);

        if (showPattern && patternColorInput) {
            const patternColor = patternColorInput.value || DEFAULT_COLORS.patternColor;
            const opacityPercent = patternOpacitySlider
                ? parseInt(patternOpacitySlider.value, 10)
                : Math.round(DEFAULT_PATTERN_OPACITY * 100);
            const patternUrl = generatePatternSvg(patternColor, opacityPercent / 100);
            preview.style.setProperty('--preview-pattern-bg', patternUrl);
        } else {
            preview.style.removeProperty('--preview-pattern-bg');
        }

        // Handle background image in preview
        const bgImageVisibleToggle = _deps.getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);
        const showBgImage = bgImageVisibleToggle?.checked !== false;
        const bgImagePreview = _deps.getElementById(DOM_IDS.BG_IMAGE_PREVIEW);

        if (showBgImage && bgImagePreview?.src && bgImagePreview.src !== window.location.href) {
            // Show background image in live preview
            preview.style.setProperty('--preview-bg-image', `url("${bgImagePreview.src}")`);
        } else {
            // Remove background image, fall back to color
            preview.style.removeProperty('--preview-bg-image');
        }

        // Handle Help Window and Quick Actions visibility in preview
        const helpToggle = _deps.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
        const quickActionsToggle = _deps.getElementById(DOM_IDS.TOGGLE_QUICK_ACTIONS);
        const previewHelp = preview.querySelector(DOM_SELECTORS.PREVIEW_HELP_WINDOW);
        const previewQuickActions = preview.querySelector(DOM_SELECTORS.PREVIEW_QUICK_ACTIONS);

        if (previewHelp) {
            previewHelp.classList.toggle(DOM_CLASSES.HIDDEN, helpToggle?.checked === false);
        }
        if (previewQuickActions) {
            previewQuickActions.classList.toggle(DOM_CLASSES.HIDDEN, quickActionsToggle?.checked === false);
        }
    }

    /**
     * Toggle a collapsible section
     * @param {HTMLElement} header - The section header element
     */
    toggleSection(header) {
        const section = header.closest(DOM_SELECTORS.PREFERENCES_SECTION) || header.closest(DOM_SELECTORS.PREFERENCES_PREVIEW_SECTION);
        if (!section) return;

        // The live preview is NOT part of the accordion, in either mode. It
        // previews the thing you are editing, so closing it when you open a
        // section would hide the feedback you opened the section to get. It is
        // excluded by being left out of `siblings`, and toggling it exclusively
        // would close whichever section you were working in — so it toggles
        // plainly whatever the setting says.
        const isPreview = !section.matches(DOM_SELECTORS.PREFERENCES_SECTION);
        toggleSectionExpanded(section, {
            siblings: isPreview ? [] : _deps.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION),
            headerSelector: DOM_SELECTORS.PREFERENCES_SECTION_HEADER,
            exclusive: !isPreview && usesExclusiveSections(_deps.AppState?.get()?.settings)
        });
        this.saveCollapsedStates();
    }

    /**
     * Load collapsed states from appState
     */
    loadCollapsedStates() {
        const state = _deps.AppState?.get();
        const collapsedSections = state?.settings?.preferencesCollapsedSections;

        // On mobile, default live-preview to collapsed if no saved state
        const isMobile = window.matchMedia('(max-width: 480px)').matches;
        const previewSection = _deps.querySelector(DATA_SELECTORS.preferencesSectionByName('live-preview'));
        if (previewSection) {
            if (isMobile) {
                const hasSaved = collapsedSections && ('live-preview' in collapsedSections);
                if (!hasSaved) {
                    previewSection.classList.add(DOM_CLASSES.COLLAPSED);
                    const header = previewSection.querySelector(DOM_SELECTORS.PREFERENCES_SECTION_HEADER);
                    if (header) header.setAttribute('aria-expanded', 'false');
                }
            } else {
                // Desktop: always expanded
                previewSection.classList.remove(DOM_CLASSES.COLLAPSED);
                const header = previewSection.querySelector(DOM_SELECTORS.PREFERENCES_SECTION_HEADER);
                if (header) header.setAttribute('aria-expanded', 'true');
            }
        }

        if (usesExclusiveSections(state?.settings)) {
            // Accordion: the settings sections open fully collapsed. The live
            // preview is deliberately not in this sweep — its own default
            // (expanded on desktop, collapsed on mobile) is applied above and
            // must survive.
            collapseAllSections(
                _deps.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION),
                DOM_SELECTORS.PREFERENCES_SECTION_HEADER
            );
            return;
        }

        if (!collapsedSections) return;

        // Accordion off — restore what was left open, as before.
        Object.entries(collapsedSections).forEach(([sectionName, isCollapsed]) => {
            const section = _deps.querySelector(DATA_SELECTORS.preferencesSectionByName(sectionName));
            if (!section) return;
            setSectionExpanded(section, !isCollapsed, {
                headerSelector: DOM_SELECTORS.PREFERENCES_SECTION_HEADER,
                exclusive: false
            });
        });
    }

    /**
     * Save collapsed states to appState
     */
    saveCollapsedStates() {
        if (!_deps.AppState) return;

        const sections = _deps.querySelectorAll(DOM_SELECTORS.PREFERENCES_SECTION_BY_DATA);
        const collapsedSections = {};

        sections.forEach(section => {
            const sectionName = section.dataset.section;
            collapsedSections[sectionName] = section.classList.contains(DOM_CLASSES.COLLAPSED);
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
        _deps.showNotification?.(getLabel('notify.undone'), 'info', UI_TIMEOUTS.NOTIFICATION_BRIEF);
    }

    /**
     * Update undo button state
     */
    updateUndoButton() {
        const undoBtn = _deps.getElementById(DOM_IDS.PREFERENCES_UNDO);
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
