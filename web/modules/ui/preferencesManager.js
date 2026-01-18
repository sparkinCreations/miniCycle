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

// ============================================================================
// BACKGROUND IMAGE CONSTANTS
// ============================================================================

const BG_IMAGE_DB_NAME = 'miniCycleBackgroundDB';
const BG_IMAGE_DB_VERSION = 1;
const BG_IMAGE_STORE = 'backgroundImage';
const BG_IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const BG_IMAGE_MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB - max file size to even attempt
const BG_IMAGE_MAX_DIMENSION = 1920; // Max width/height for compression
const BG_IMAGE_COMPRESSION_TIMEOUT = 30000; // 30 seconds timeout

// Allowed image MIME types (security: block SVG to prevent XSS)
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

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

/**
 * Validate image file for security
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateImageFile(file) {
    // Check if file exists
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    // Check MIME type (block SVG for XSS prevention)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        return { valid: false, error: 'Invalid file type. Please use JPG, PNG, WebP, or GIF.' };
    }

    // Check file size limit for attempting compression
    if (file.size > BG_IMAGE_MAX_UPLOAD_SIZE) {
        return { valid: false, error: 'Image too large (max 20MB). Please use a smaller image.' };
    }

    // Check file extension matches MIME type (basic validation)
    const ext = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!validExtensions.includes(ext)) {
        return { valid: false, error: 'Invalid file extension. Please use JPG, PNG, WebP, or GIF.' };
    }

    return { valid: true };
}

/**
 * Compress an image file to fit within size limit
 * Uses Canvas API - no external libraries needed
 * @param {File} file - The image file to compress
 * @param {number} maxSize - Maximum size in bytes
 * @param {number} maxDimension - Maximum width/height
 * @returns {Promise<{dataUrl: string, originalSize: number, compressedSize: number, quality: number}>}
 */
async function compressImage(file, maxSize = BG_IMAGE_MAX_SIZE, maxDimension = BG_IMAGE_MAX_DIMENSION) {
    return new Promise((resolve, reject) => {
        // Set timeout to prevent hanging on corrupt files
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Image processing timed out. The file may be corrupt.'));
        }, BG_IMAGE_COMPRESSION_TIMEOUT);

        const img = new Image();
        let objectUrl = null;

        // Cleanup function to revoke object URL and clear timeout
        const cleanup = () => {
            clearTimeout(timeout);
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    cleanup();
                    reject(new Error('Failed to create canvas context'));
                    return;
                }

                // Calculate new dimensions (maintain aspect ratio)
                let { width, height } = img;
                const originalWidth = width;
                const originalHeight = height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Try progressively lower quality until under size limit
                let quality = 0.9;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                while (dataUrl.length > maxSize && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                // If still too large, reduce dimensions further
                if (dataUrl.length > maxSize) {
                    const scale = 0.7;
                    canvas.width = Math.round(width * scale);
                    canvas.height = Math.round(height * scale);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    quality = 0.7;
                }

                const compressedSize = Math.round(dataUrl.length * 0.75); // Approximate actual size (base64 overhead)

                console.log(`📸 Image compressed: ${originalWidth}x${originalHeight} → ${canvas.width}x${canvas.height}, ${(file.size / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (quality: ${(quality * 100).toFixed(0)}%)`);

                cleanup();
                resolve({
                    dataUrl,
                    originalSize: file.size,
                    compressedSize,
                    quality: Math.round(quality * 100)
                });
            } catch (err) {
                cleanup();
                reject(new Error('Failed to process image: ' + err.message));
            }
        };

        img.onerror = () => {
            cleanup();
            reject(new Error('Failed to load image. The file may be corrupt or unsupported.'));
        };

        // Create object URL and load image
        objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
    });
}

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
            this.initBgImage(); // Load saved background image

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

        // Pattern color input (special handling - generates SVG dynamically)
        const patternColorInput = document.getElementById('pref-pattern-color');
        if (patternColorInput) {
            this.colorInputs['pref-pattern-color'] = patternColorInput;
            patternColorInput._changeHandler = (e) => this.handlePatternColorChange(e.target.value);
            safeAdd(patternColorInput, 'input', patternColorInput._changeHandler);
        }

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

        // Background pattern visibility toggle
        const bgPatternToggle = document.getElementById('toggle-bg-pattern');
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
        const bgImageVisibleToggle = document.getElementById('toggle-bg-image-visible');
        if (bgImageVisibleToggle) {
            bgImageVisibleToggle._changeHandler = (e) => this.handleBgImageVisibleToggle(e.target.checked);
            safeAdd(bgImageVisibleToggle, 'change', bgImageVisibleToggle._changeHandler);

            const toggleSwitch = bgImageVisibleToggle.closest('.toggle-switch');
            if (toggleSwitch) {
                toggleSwitch._clickHandler = (e) => {
                    if (e.target !== bgImageVisibleToggle) {
                        bgImageVisibleToggle.checked = !bgImageVisibleToggle.checked;
                        this.handleBgImageVisibleToggle(bgImageVisibleToggle.checked);
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

        // Background image upload
        const bgImageUploadBtn = document.getElementById('bg-image-upload-btn');
        const bgImageUpload = document.getElementById('bg-image-upload');
        const bgImageRemoveBtn = document.getElementById('bg-image-remove-btn');
        const bgImageMode = document.getElementById('bg-image-mode');

        if (bgImageUploadBtn && bgImageUpload) {
            bgImageUploadBtn._clickHandler = () => bgImageUpload.click();
            safeAdd(bgImageUploadBtn, 'click', bgImageUploadBtn._clickHandler);

            bgImageUpload._changeHandler = (e) => this.handleBgImageUpload(e);
            safeAdd(bgImageUpload, 'change', bgImageUpload._changeHandler);
        }

        if (bgImageRemoveBtn) {
            bgImageRemoveBtn._clickHandler = () => this.removeBgImage();
            safeAdd(bgImageRemoveBtn, 'click', bgImageRemoveBtn._clickHandler);
        }

        if (bgImageMode) {
            bgImageMode._changeHandler = (e) => this.handleBgImageModeChange(e.target.value);
            safeAdd(bgImageMode, 'change', bgImageMode._changeHandler);
        }

        // Collapsible sections
        document.querySelectorAll('.preferences-section-header.collapsible').forEach(header => {
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
            const bgData = await this.loadBgImage();
            this.updateBgImageUI(bgData?.dataUrl || null, bgData?.mode || 'cover');

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

        // Load background pattern visibility toggle state
        const bgPatternToggle = document.getElementById('toggle-bg-pattern');
        if (bgPatternToggle) {
            const showPattern = customColors.showBgPattern !== false; // Default to true
            bgPatternToggle.checked = showPattern;
            // Apply body class immediately
            document.body.classList.toggle('no-bg-pattern', !showPattern);
        }

        // Load background image visibility toggle state
        const bgImageVisibleToggle = document.getElementById('toggle-bg-image-visible');
        if (bgImageVisibleToggle) {
            const showBgImage = customColors.showBgImage !== false; // Default to true
            bgImageVisibleToggle.checked = showBgImage;
            // Note: The has-bg-image class is handled by applyBgImage based on this setting
        }

        // Load pattern color input
        const patternColorInput = document.getElementById('pref-pattern-color');
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
     * Handle background image visibility toggle
     * @param {boolean} visible - Whether the background image should be visible
     */
    handleBgImageVisibleToggle(visible) {
        console.log('🖼️ Background image visibility toggle:', visible);

        // Save to appState
        if (_deps.AppState) {
            _deps.AppState.update(state => {
                if (!state.settings.customColors) {
                    state.settings.customColors = {};
                }
                state.settings.customColors.showBgImage = visible;
            });
        }

        // Toggle body class to show/hide background image
        // The image data stays in IndexedDB, we just hide/show it via CSS class
        document.body.classList.toggle('has-bg-image', visible);

        // Update status bar color (black for custom background, blue for default)
        updateThemeColor();

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

    // =========================================================================
    // BACKGROUND IMAGE METHODS
    // =========================================================================

    /**
     * Open the background image IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    openBgImageDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(BG_IMAGE_DB_NAME, BG_IMAGE_DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(BG_IMAGE_STORE)) {
                    db.createObjectStore(BG_IMAGE_STORE, { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Handle background image file upload
     * @param {Event} event - The file input change event
     */
    async handleBgImageUpload(event) {
        const file = event.target.files?.[0];

        // Reset input early so same file can be selected again
        if (event.target) {
            event.target.value = '';
        }

        if (!file) return;

        // Security validation
        const validation = validateImageFile(file);
        if (!validation.valid) {
            _deps.showNotification?.(validation.error, 'error', 4000);
            console.warn('🚫 Image upload rejected:', validation.error);
            return;
        }

        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        console.log(`📤 Processing image: ${file.name} (${fileSizeMB}MB, ${file.type})`);

        try {
            let dataUrl;
            let compressionInfo = null;

            // Compress if over size limit, otherwise read directly
            if (file.size > BG_IMAGE_MAX_SIZE) {
                _deps.showNotification?.(`Compressing ${fileSizeMB}MB image...`, 'info', 3000);

                const result = await compressImage(file);
                dataUrl = result.dataUrl;
                compressionInfo = result;
            } else {
                // File is small enough, read directly
                dataUrl = await this.readFileAsDataURL(file);
            }

            // Verify we got valid data
            if (!dataUrl || !dataUrl.startsWith('data:image/')) {
                throw new Error('Invalid image data generated');
            }

            // Get current display mode
            const modeSelect = document.getElementById('bg-image-mode');
            const mode = modeSelect?.value || 'cover';

            // Save to IndexedDB
            await this.saveBgImage(dataUrl, mode);

            // Apply to body
            this.applyBgImage(dataUrl, mode);

            // Update UI
            this.updateBgImageUI(dataUrl, mode);

            // Update live preview
            this.updatePreview();

            // Show success notification with compression details
            if (compressionInfo) {
                const savedKB = Math.round((compressionInfo.originalSize - compressionInfo.compressedSize) / 1024);
                _deps.showNotification?.(
                    `Image set! Compressed ${savedKB}KB (${compressionInfo.quality}% quality)`,
                    'success',
                    3000
                );
            } else {
                _deps.showNotification?.('Background image set', 'success', 2000);
            }

            console.log('✅ Background image uploaded successfully');

        } catch (error) {
            console.error('❌ Failed to upload background image:', error);

            // Provide specific error messages
            let errorMessage = 'Failed to set background image';
            if (error.message.includes('timed out')) {
                errorMessage = 'Image processing timed out. Try a smaller image.';
            } else if (error.message.includes('corrupt')) {
                errorMessage = 'Image appears to be corrupt. Try another file.';
            } else if (error.message.includes('memory') || error.message.includes('quota')) {
                errorMessage = 'Not enough storage space. Try a smaller image.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            _deps.showNotification?.(errorMessage, 'error', 4000);
        }
    }

    /**
     * Read a file as data URL
     * @param {File} file - The file to read
     * @returns {Promise<string>} - The data URL
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Save background image to IndexedDB
     * @param {string} dataUrl - The image data URL
     * @param {string} mode - The display mode
     */
    async saveBgImage(dataUrl, mode) {
        const db = await this.openBgImageDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([BG_IMAGE_STORE], 'readwrite');
            const store = transaction.objectStore(BG_IMAGE_STORE);

            const data = {
                id: 'background',
                dataUrl: dataUrl,
                mode: mode,
                updatedAt: Date.now()
            };

            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);

            transaction.oncomplete = () => db.close();
        });
    }

    /**
     * Load background image from IndexedDB
     * @returns {Promise<{dataUrl: string, mode: string}|null>}
     */
    async loadBgImage() {
        try {
            const db = await this.openBgImageDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([BG_IMAGE_STORE], 'readonly');
                const store = transaction.objectStore(BG_IMAGE_STORE);
                const request = store.get('background');

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? { dataUrl: result.dataUrl, mode: result.mode } : null);
                };
                request.onerror = () => reject(request.error);

                transaction.oncomplete = () => db.close();
            });
        } catch (error) {
            console.warn('Failed to load background image:', error);
            return null;
        }
    }

    /**
     * Apply background image to body
     * @param {string} dataUrl - The image data URL
     * @param {string} mode - The display mode (cover, center, tile)
     */
    applyBgImage(dataUrl, mode) {
        const body = document.body;

        // Set the CSS variable for the image (always set it so it's ready when toggled on)
        document.documentElement.style.setProperty('--custom-bg-image', `url("${dataUrl}")`);

        // Check if the image should be visible based on user preference
        const customColors = _deps.AppState?.get()?.settings?.customColors || {};
        const showBgImage = customColors.showBgImage !== false; // Default to true

        // Only add has-bg-image class if the toggle is on
        if (showBgImage) {
            body.classList.add('has-bg-image');
            // Update status bar color to black for custom background
            updateThemeColor();
        }

        // Remove any existing mode classes
        body.classList.remove('bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');

        // Add the appropriate mode class
        body.classList.add(`bg-mode-${mode}`);
    }

    /**
     * Remove background image
     */
    async removeBgImage() {
        try {
            // Remove from IndexedDB
            const db = await this.openBgImageDB();
            await new Promise((resolve, reject) => {
                const transaction = db.transaction([BG_IMAGE_STORE], 'readwrite');
                const store = transaction.objectStore(BG_IMAGE_STORE);
                const request = store.delete('background');

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);

                transaction.oncomplete = () => db.close();
            });

            // Remove from body
            const body = document.body;
            document.documentElement.style.removeProperty('--custom-bg-image');
            body.classList.remove('has-bg-image', 'bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');

            // Update status bar color (back to blue for default view)
            updateThemeColor();

            // Update UI
            this.updateBgImageUI(null, 'cover');

            // Update live preview
            this.updatePreview();

            _deps.showNotification?.('Background image removed', 'info', 2000);
        } catch (error) {
            console.error('Failed to remove background image:', error);
            _deps.showNotification?.('Failed to remove background image', 'error', 3000);
        }
    }

    /**
     * Handle display mode change
     * @param {string} mode - The new display mode
     */
    async handleBgImageModeChange(mode) {
        try {
            // Load current image
            const bgData = await this.loadBgImage();
            if (!bgData) return;

            // Save with new mode
            await this.saveBgImage(bgData.dataUrl, mode);

            // Apply new mode
            const body = document.body;
            body.classList.remove('bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');
            body.classList.add(`bg-mode-${mode}`);
        } catch (error) {
            console.error('Failed to change display mode:', error);
        }
    }

    /**
     * Update the background image UI elements
     * @param {string|null} dataUrl - The image data URL (null if no image)
     * @param {string} mode - The display mode
     */
    updateBgImageUI(dataUrl, mode) {
        const optionsDiv = document.getElementById('bg-image-options');
        const removeBtn = document.getElementById('bg-image-remove-btn');
        const preview = document.getElementById('bg-image-preview');
        const modeSelect = document.getElementById('bg-image-mode');
        const visibleToggle = document.getElementById('toggle-bg-image-visible');

        if (dataUrl) {
            // Show options and remove button
            if (optionsDiv) optionsDiv.style.display = 'block';
            if (removeBtn) removeBtn.style.display = 'inline-block';
            if (preview) preview.src = dataUrl;
            if (modeSelect) modeSelect.value = mode;

            // Set the visibility toggle state from saved preference
            if (visibleToggle) {
                const customColors = _deps.AppState?.get()?.settings?.customColors || {};
                visibleToggle.checked = customColors.showBgImage !== false; // Default to true
            }
        } else {
            // Hide options and remove button
            if (optionsDiv) optionsDiv.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'none';
            if (preview) preview.src = '';
            if (modeSelect) modeSelect.value = 'cover';
        }
    }

    /**
     * Initialize background image on startup
     */
    async initBgImage() {
        try {
            const bgData = await this.loadBgImage();
            if (bgData) {
                this.applyBgImage(bgData.dataUrl, bgData.mode);
                this.updateBgImageUI(bgData.dataUrl, bgData.mode);
            }
        } catch (error) {
            console.warn('Failed to initialize background image:', error);
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
            } else if (config.key === 'appBg') {
                // Always set appBg to ensure iOS status bar shows correct color
                root.style.setProperty(config.cssVar, DEFAULT_COLORS.appBg);
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
        const preview = document.getElementById('preferences-preview');
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

        // Handle background pattern color in preview
        const bgPatternToggle = document.getElementById('toggle-bg-pattern');
        const showPattern = bgPatternToggle?.checked !== false;
        const patternColorInput = document.getElementById('pref-pattern-color');

        if (showPattern && patternColorInput) {
            const patternColor = patternColorInput.value || DEFAULT_COLORS.patternColor;
            const patternUrl = generatePatternSvg(patternColor, DEFAULT_PATTERN_OPACITY);
            preview.style.setProperty('--preview-pattern-bg', patternUrl);
        } else {
            preview.style.removeProperty('--preview-pattern-bg');
        }

        // Handle background image in preview
        const bgImageVisibleToggle = document.getElementById('toggle-bg-image-visible');
        const showBgImage = bgImageVisibleToggle?.checked !== false;
        const bgImagePreview = document.getElementById('bg-image-preview');

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
