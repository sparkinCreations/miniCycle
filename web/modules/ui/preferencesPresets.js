/**
 * Preferences Presets Sub-Module
 *
 * Handles built-in quick presets and custom preset CRUD operations
 * (save, load, rename, delete, export, import) for the preferences panel.
 *
 * Loaded dynamically by preferencesManager.js with version cache-busting.
 *
 * @module ui/preferencesPresets
 */

import { DOM_IDS, DOM_SELECTORS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// PRESET VALIDATION
// ============================================================================

/** Current export format version */
const PRESET_VERSION = 2;

/**
 * Keys allowed in a preset's colors object, grouped by type.
 * Only keys listed here are accepted during import — unknown keys are stripped.
 */
const PRESET_COLOR_KEYS = [
    'appBg', 'taskListBg', 'taskBg', 'taskText', 'titleBg', 'titleText',
    'checkboxBg', 'checkboxIncompleteBg', 'checkmark', 'completeBtn',
    'clearBtn', 'progressBar', 'statsBg', 'statsText', 'statsProgress',
    'statsDoughnut', 'panelText', 'patternColor'
];

const PRESET_BOOLEAN_KEYS = [
    'showCheckboxFill', 'showCheckboxIncomplete', 'showBgPattern',
    'showBgImage', 'solidListBg', 'solidStatsBg',
    'showHelpWindow', 'showQuickActions'
];

const PRESET_NUMBER_KEYS = {
    patternOpacity: { min: 1, max: 25 }
};

/** All allowed keys (union of color + boolean + number) */
const VALID_PRESET_KEYS = new Set([
    ...PRESET_COLOR_KEYS,
    ...PRESET_BOOLEAN_KEYS,
    ...Object.keys(PRESET_NUMBER_KEYS)
]);

/** Validate a hex color string (#RGB, #RRGGBB, or #RRGGBBAA) */
const isValidHex = (v) => typeof v === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(v);

/**
 * Sanitize a preset colors object: strip unknown keys, validate types.
 * Returns a clean object with only valid entries.
 * @param {Object} raw - The raw colors object from an import
 * @returns {Object} Sanitized colors object
 */
function sanitizePresetColors(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const clean = {};

    for (const [key, value] of Object.entries(raw)) {
        if (!VALID_PRESET_KEYS.has(key)) continue; // strip unknown keys

        if (PRESET_COLOR_KEYS.includes(key)) {
            if (isValidHex(value)) clean[key] = value;
        } else if (PRESET_BOOLEAN_KEYS.includes(key)) {
            if (typeof value === 'boolean') clean[key] = value;
        } else if (key in PRESET_NUMBER_KEYS) {
            const range = PRESET_NUMBER_KEYS[key];
            if (typeof value === 'number' && value >= range.min && value <= range.max) {
                clean[key] = value;
            }
        }
    }

    return clean;
}

// ============================================================================
// QUICK PRESET THEMES (Built-in)
// ============================================================================
// NOTE: DEFAULT_COLORS lives in preferencesManager.js (single source of truth).
// The 'default' preset delegates entirely to resetAllColors() and never reads
// its colors, so no copy is needed here.

const QUICK_PRESETS = {
    default: {
        name: 'Default',
        shortName: 'Default',
        title: 'Default blue theme',
        swatch: ['#4c79ff', '#ffffff'],
        colors: {}
    },
    warm: {
        name: 'Warm',
        shortName: 'Warm',
        title: 'Warm sunset colors',
        swatch: ['#ff6b6b', '#ffeaa7'],
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
            statsText: '#5c4033',
            statsProgress: '#e17055',
            statsDoughnut: '#fd79a8',
            panelText: '#ffffff'
        }
    },
    cool: {
        name: 'Cool',
        shortName: 'Cool',
        title: 'Cool ocean colors',
        swatch: ['#74b9ff', '#e8f8f5'],
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
            statsText: '#2c3e50',
            statsProgress: '#0984e3',
            statsDoughnut: '#00cec9',
            panelText: '#1a3a5c'
        }
    },
    forest: {
        name: 'Forest',
        shortName: 'Forest',
        title: 'Natural forest colors',
        swatch: ['#2d5016', '#d4edda'],
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
            statsText: '#1b4332',
            statsProgress: '#2e7d32',
            statsDoughnut: '#388e3c',
            panelText: '#ffffff'
        }
    },
    monochrome: {
        name: 'Monochrome',
        shortName: 'Mono',
        title: 'Elegant grayscale',
        swatch: ['#2d3436', '#dfe6e9'],
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
            statsText: '#2d3436',
            statsProgress: '#636e72',
            statsDoughnut: '#636e72',
            panelText: '#ffffff'
        }
    },
    professional: {
        name: 'Professional',
        shortName: 'Pro',
        title: 'Clean minimal look',
        swatch: ['#007aff', '#b7c3d1'],
        colors: {
            appBg: '#b7c3d1',
            taskListBg: '#ffffff',
            taskBg: '#d3dbe4',
            taskText: '#1d1d1f',
            titleBg: '#f0f2f5',
            titleText: '#1d1d1f',
            checkboxBg: '#007aff',
            checkboxIncompleteBg: '#c7c7cc',
            checkmark: '#ffffff',
            completeBtn: '#34c759',
            clearBtn: '#007aff',
            progressBar: '#007aff',
            statsBg: '#ffffff',
            statsText: '#1d1d1f',
            statsProgress: '#007aff',
            statsDoughnut: '#34c759',
            panelText: '#2c2c2e',
            celebrationBg: '#4c76ae',
            resetFlash: '#405f87'
        }
    },
    goldenGlow: {
        name: 'Golden Glow',
        shortName: 'Golden',
        title: 'Golden glow theme',
        swatch: ['#d4a017', '#fffef5'],
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
            statsText: '#5c4a1f',
            statsProgress: '#daa520',
            statsDoughnut: '#c9a227',
            panelText: '#4a3810'
        }
    },
    darkOcean: {
        name: 'Dark Ocean',
        shortName: 'Ocean',
        title: 'Dark ocean theme',
        swatch: ['#0a2540', '#1a3a5c'],
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
            statsText: '#e0f0ff',
            statsProgress: '#0ea5e9',
            statsDoughnut: '#06b6d4',
            panelText: '#e0f0ff'
        }
    },
    berry: {
        name: 'Berry',
        shortName: 'Berry',
        title: 'Berry purple theme',
        swatch: ['#7c3aed', '#faf5ff'],
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
            statsText: '#4c1d95',
            statsProgress: '#8b5cf6',
            statsDoughnut: '#a855f7',
            panelText: '#ffffff'
        }
    }
};

// ============================================================================
// QUICK PRESET APPLICATION
// ============================================================================

/**
 * Apply a quick preset theme
 * @param {string} presetKey - The preset key
 * @param {Object} callbacks - { saveColor, resetAllColors, loadSavedColors, updatePreview, applyCustomColors, pushToUndoStack, updateUndoButton, isDefaultTheme, showNotification }
 */
export function applyQuickPreset(presetKey, callbacks) {
    const preset = QUICK_PRESETS[presetKey];
    if (!preset) return;

    // Default preset should behave the same as Reset All
    if (presetKey === 'default') {
        callbacks.resetAllColors();
        return;
    }

    callbacks.pushToUndoStack();

    // Apply preset colors
    Object.entries(preset.colors).forEach(([key, color]) => {
        callbacks.saveColor(key, color);
    });

    // Update inputs
    callbacks.loadSavedColors();
    callbacks.updatePreview();

    if (callbacks.isDefaultTheme()) {
        callbacks.applyCustomColors();
    }

    callbacks.updateUndoButton();
    callbacks.showNotification?.(getLabel('notify.themeApplied', { vars: { name: preset.name } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
}

// ============================================================================
// CUSTOM PRESET CRUD
// ============================================================================

/**
 * Prompt user for preset name and save current colors
 * @param {Object} deps - Dependencies { AppState, showPromptModal, showNotification }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function promptSavePreset(deps, renderPresetsList) {
    if (deps.showPromptModal) {
        deps.showPromptModal({
            title: getLabel('modal.savePresetTitle'),
            message: getLabel('modal.savePresetMessage'),
            placeholder: getLabel('modal.savePresetPlaceholder'),
            confirmText: getLabel('button.save'),
            cancelText: getLabel('button.cancel'),
            required: true,
            callback: (name) => {
                if (name && name.trim()) {
                    savePreset(name.trim(), deps, renderPresetsList);
                }
            }
        });
    } else {
        // Fallback to native prompt
        const name = prompt(getLabel('modal.savePresetMessage'));
        if (name && name.trim()) {
            savePreset(name.trim(), deps, renderPresetsList);
        }
    }
}

/**
 * Save current colors as a new preset
 * @param {string} name - Name for the preset
 * @param {Object} deps - Dependencies { AppState, showNotification }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function savePreset(name, deps, renderPresetsList) {
    if (!deps.AppState) return;

    const state = deps.AppState.get();
    const rawColors = { ...state?.settings?.customColors } || {};

    // Strip null/undefined values — they mean "use default" and shouldn't be in presets.
    const presetColors = Object.fromEntries(
        Object.entries(rawColors).filter(([, v]) => v != null)
    );

    // Create new preset
    const preset = {
        id: Date.now().toString(),
        name: name,
        colors: presetColors,
        createdAt: Date.now()
    };

    deps.AppState.update(state => {
        if (!state.settings.savedColorPresets) {
            state.settings.savedColorPresets = [];
        }
        state.settings.savedColorPresets.push(preset);
    });

    renderPresetsList();
    deps.showNotification?.(getLabel('notify.presetSaved', { vars: { name } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Load a preset's colors
 * @param {string} presetId - ID of the preset to load
 * @param {Object} deps - Dependencies { AppState, showNotification }
 * @param {Object} callbacks - { pushToUndoStack, loadSavedColors, updatePreview, applyCustomColors, updateUndoButton }
 */
export function loadPreset(presetId, deps, callbacks) {
    if (!deps.AppState) return;

    const state = deps.AppState.get();
    const presets = state?.settings?.savedColorPresets || [];
    const preset = presets.find(p => p.id === presetId);

    if (!preset) {
        deps.showNotification?.(getLabel('notify.presetNotFound'), 'error', UI_TIMEOUTS.NOTIFICATION_SHORT);
        return;
    }

    callbacks.pushToUndoStack();

    // Merge preset colors on top of current customColors instead of replacing.
    // This preserves panel-visibility and any keys not in the preset (e.g. keys
    // added after the preset was saved). Preset values override current ones.
    deps.AppState.update(state => {
        if (!state.settings.customColors) state.settings.customColors = {};
        Object.assign(state.settings.customColors, preset.colors);
    });

    callbacks.loadSavedColors();
    callbacks.updatePreview();
    callbacks.applyCustomColors();
    callbacks.updateUndoButton();

    deps.showNotification?.(getLabel('notify.presetLoaded', { vars: { name: preset.name } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Rename a preset
 * @param {string} presetId - ID of the preset to rename
 * @param {string} newName - New name for the preset
 * @param {Object} deps - Dependencies { AppState, showNotification }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function renamePreset(presetId, newName, deps, renderPresetsList) {
    if (!deps.AppState || !newName.trim()) return;

    deps.AppState.update(state => {
        const presets = state.settings.savedColorPresets || [];
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            preset.name = newName.trim();
        }
    });

    renderPresetsList();
    deps.showNotification?.(getLabel('notify.presetRenamed'), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Delete a preset
 * @param {string} presetId - ID of the preset to delete
 * @param {Object} deps - Dependencies { AppState, showNotification, showConfirmationModal }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function deletePreset(presetId, deps, renderPresetsList) {
    if (!deps.AppState) return;

    const state = deps.AppState.get();
    const presets = state?.settings?.savedColorPresets || [];
    const preset = presets.find(p => p.id === presetId);

    if (!preset) return;

    const doDelete = () => {
        deps.AppState.update(state => {
            state.settings.savedColorPresets = (state.settings.savedColorPresets || [])
                .filter(p => p.id !== presetId);
        });

        renderPresetsList();
        deps.showNotification?.(getLabel('notify.presetDeleted'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
    };

    if (deps.showConfirmationModal) {
        deps.showConfirmationModal({
            title: getLabel('modal.deletePresetTitle'),
            message: getLabel('modal.confirmDeletePreset', { vars: { name: preset.name } }),
            confirmText: getLabel('button.delete'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: (confirmed) => {
                if (confirmed) {
                    doDelete();
                }
            }
        });
    } else {
        // Fallback to native confirm
        if (confirm(getLabel('modal.confirmDeletePreset', { vars: { name: preset.name } }))) {
            doDelete();
        }
    }
}

/**
 * Export a preset as a shareable code
 * @param {string} presetId - ID of the preset to export
 * @param {Object} deps - Dependencies { AppState, showNotification, showPromptModal }
 */
export function exportPreset(presetId, deps) {
    const state = deps.AppState?.get();
    const presets = state?.settings?.savedColorPresets || [];
    const preset = presets.find(p => p.id === presetId);

    if (!preset) return;

    const exportData = {
        name: preset.name,
        colors: preset.colors,
        version: PRESET_VERSION
    };

    // Fix #42: Handle Unicode characters that btoa can't encode
    const jsonStr = JSON.stringify(exportData);
    const code = btoa(unescape(encodeURIComponent(jsonStr)));

    // Try to copy to clipboard
    navigator.clipboard.writeText(code).then(() => {
        deps.showNotification?.(getLabel('notify.presetCopied'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
    }).catch(() => {
        // Fallback: show code in a modal for manual copying
        if (deps.showPromptModal) {
            deps.showPromptModal({
                title: getLabel('modal.exportPresetTitle'),
                message: getLabel('modal.exportPresetMessage'),
                defaultValue: code,
                confirmText: getLabel('button.done'),
                cancelText: getLabel('button.close'),
                callback: () => {}
            });
        } else {
            prompt(getLabel('modal.exportPresetMessage'), code);
        }
    });
}

/**
 * Prompt user to import a preset from code
 * @param {Object} deps - Dependencies { AppState, showPromptModal, showNotification }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function promptImportPreset(deps, renderPresetsList) {
    if (deps.showPromptModal) {
        deps.showPromptModal({
            title: getLabel('modal.importPresetTitle'),
            message: getLabel('modal.importPresetMessage'),
            placeholder: getLabel('modal.importPresetPlaceholder'),
            confirmText: getLabel('button.import'),
            cancelText: getLabel('button.cancel'),
            required: true,
            callback: (code) => {
                if (code && code.trim()) {
                    importPreset(code.trim(), deps, renderPresetsList);
                }
            }
        });
    } else {
        // Fallback to native prompt
        const code = prompt(getLabel('modal.importPresetMessage'));
        if (code && code.trim()) {
            importPreset(code.trim(), deps, renderPresetsList);
        }
    }
}

/**
 * Import a preset from a code string
 * @param {string} code - The preset code
 * @param {Object} deps - Dependencies { AppState, showNotification }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function importPreset(code, deps, renderPresetsList) {
    try {
        // Fix #42 (import side): Decode Unicode characters that were encoded during export
        const data = JSON.parse(decodeURIComponent(escape(atob(code))));

        // Structural validation
        if (!data.name || typeof data.name !== 'string') {
            throw new Error('Missing or invalid preset name');
        }
        if (!data.colors || typeof data.colors !== 'object' || Array.isArray(data.colors)) {
            throw new Error('Missing or invalid colors object');
        }

        // Sanitize: strip unknown keys, validate types, remove panel-visibility keys
        const sanitized = sanitizePresetColors(data.colors);

        // Must have at least one valid color key after sanitization
        const hasColors = Object.keys(sanitized).some(k => PRESET_COLOR_KEYS.includes(k));
        if (!hasColors) {
            throw new Error('No valid color values found');
        }

        // Save as new preset
        if (!deps.AppState) return;

        const preset = {
            id: Date.now().toString(),
            name: data.name + ' (imported)',
            colors: sanitized,
            createdAt: Date.now()
        };

        deps.AppState.update(state => {
            if (!state.settings.savedColorPresets) {
                state.settings.savedColorPresets = [];
            }
            state.settings.savedColorPresets.push(preset);
        });

        renderPresetsList();
        deps.showNotification?.(getLabel('notify.presetImported', { vars: { name: data.name } }), 'success', UI_TIMEOUTS.NOTIFICATION_SHORT);

    } catch (error) {
        deps.showNotification?.(getLabel('notify.invalidPreset'), 'error', UI_TIMEOUTS.NOTIFICATION_SHORT);
    }
}

// ============================================================================
// PRESET LIST RENDERING
// ============================================================================

/**
 * Render the saved presets list in the UI
 * @param {Object} deps - Dependencies { AppState }
 * @param {Object} callbacks - { loadPreset, exportPreset, deletePreset, startRenamePreset }
 */
export function renderPresetsList(deps, callbacks) {
    const listContainer = document.getElementById(DOM_IDS.PREFERENCES_PRESETS_LIST);
    const noPresetsMsg = document.getElementById(DOM_IDS.PREFERENCES_NO_PRESETS);

    if (!listContainer) return;

    const state = deps.AppState?.get();
    const presets = state?.settings?.savedColorPresets || [];

    // Clear existing items
    const existingItems = listContainer.querySelectorAll(DOM_SELECTORS.PREFERENCES_PRESET_ITEM);
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
        const swatchHtml = createPresetSwatch(preset.colors);

        item.innerHTML = `
            ${swatchHtml}
            <span class="preferences-preset-name" title="Click to rename">${escapeHtml(preset.name)}</span>
            <div class="preferences-preset-actions">
                <button class="preferences-preset-btn load-btn" title="Load this preset">Load</button>
                <button class="preferences-preset-btn export-btn" title="Export as code">Export</button>
                <button class="preferences-preset-btn delete-btn" title="Delete this preset">Del</button>
            </div>
        `;

        // Add event listeners
        const nameSpan = item.querySelector(DOM_SELECTORS.PREFERENCES_PRESET_NAME);
        const loadBtn = item.querySelector(DOM_SELECTORS.LOAD_BTN);
        const exportBtn = item.querySelector(DOM_SELECTORS.EXPORT_BTN);
        const deleteBtn = item.querySelector(DOM_SELECTORS.DELETE_BTN);

        nameSpan.addEventListener('click', () => callbacks.startRenamePreset(preset.id, nameSpan));
        loadBtn.addEventListener('click', () => callbacks.loadPreset(preset.id));
        exportBtn.addEventListener('click', () => callbacks.exportPreset(preset.id));
        deleteBtn.addEventListener('click', () => callbacks.deletePreset(preset.id));

        listContainer.appendChild(item);
    });
}

/**
 * Create color swatch HTML for a preset
 * @param {Object} colors - The preset colors
 * @returns {string} HTML string for the swatch
 */
export function createPresetSwatch(colors) {
    // Fallback values mirror DEFAULT_COLORS in preferencesManager.js
    const swatchColors = [
        colors.appBg        || '#4c79ff',
        colors.taskListBg   || '#ffffff',
        colors.checkboxBg   || '#5db567',
        colors.completeBtn  || '#08c352'
    ];

    // Fix #41: Validate colors to prevent CSS injection
    const isValidColor = (c) => /^#[0-9A-Fa-f]{3,8}$|^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$|^[a-zA-Z]+$/.test(c);
    const safeColors = swatchColors.map(color => isValidColor(color) ? color : '#cccccc');

    return `
        <div class="preferences-preset-swatch">
            ${safeColors.map(color =>
                `<span class="preferences-preset-swatch-color" style="background: ${color}"></span>`
            ).join('')}
        </div>
    `;
}

/**
 * Start inline editing of preset name
 * @param {string} presetId - ID of the preset
 * @param {HTMLElement} nameSpan - The span element to replace with input
 * @param {Object} deps - Dependencies { AppState, showNotification }
 * @param {Function} doRenamePreset - Callback to rename preset
 * @param {Function} doRenderPresetsList - Callback to re-render presets list
 */
export function startRenamePreset(presetId, nameSpan, deps, doRenamePreset, doRenderPresetsList) {
    const currentName = nameSpan.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'preferences-preset-name-input';
    input.value = currentName;
    input.setAttribute('aria-label', getLabel('accessibility.editPresetName'));

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const finishEdit = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            doRenamePreset(presetId, newName);
        } else {
            doRenderPresetsList();
        }
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit();
        } else if (e.key === 'Escape') {
            doRenderPresetsList();
        }
    });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================================
// QUICK PRESET BUTTON RENDERING
// ============================================================================

/**
 * Render quick preset buttons dynamically from QUICK_PRESETS data.
 * Called by preferencesManager.js before binding click handlers.
 * @param {HTMLElement} container - The grid container element
 */
export function renderQuickPresets(container) {
    if (!container) return;
    container.innerHTML = '';

    Object.entries(QUICK_PRESETS).forEach(([key, preset]) => {
        const btn = document.createElement('button');
        btn.className = 'quick-preset-btn';
        btn.dataset.preset = key;
        btn.title = preset.title;

        const swatch = document.createElement('span');
        swatch.className = 'quick-preset-swatch';
        swatch.style.background =
            `linear-gradient(135deg, ${preset.swatch[0]} 50%, ${preset.swatch[1]} 50%)`;

        const name = document.createElement('span');
        name.className = 'quick-preset-name';
        name.textContent = preset.shortName;

        btn.appendChild(swatch);
        btn.appendChild(name);
        container.appendChild(btn);
    });
}
