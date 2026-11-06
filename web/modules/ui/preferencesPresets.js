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
import { isValidHex } from '../utils/styleValidators.js';
import { PRESET_COLOR_KEYS, QUICK_PRESET_DATA } from './quickPresetData.js';

// ============================================================================
// PRESET VALIDATION
// ============================================================================

/** Current export format version */
const PRESET_VERSION = 2;

/**
 * Keys allowed in a preset beside the colour keys (PRESET_COLOR_KEYS, in
 * quickPresetData.js). Only allow-listed keys survive an import.
 */
const PRESET_BOOLEAN_KEYS = [
    'showCheckboxFill', 'showCheckboxIncomplete', 'showBgPattern',
    'showBgImage', 'solidListBg', 'solidStatsBg', 'solidActionButtons',
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

/**
 * Built-in quick presets.
 *
 * A FUNCTION, not a const object, and every getLabel key is a LITERAL. The
 * tempting shape — a table of key strings, each resolved by building the key
 * from the preset id — works at runtime and silently drops all 27 keys out of
 * `validate:labels`,
 * which reports dynamic keys but never gates them (the trap recorded for the
 * tour prompts in v2.503). Resolving per call also means a theme's label
 * overrides apply, which a module-load-time const would freeze.
 *
 * The preset.* label block existed since the labels were first written and was
 * never wired to anything — this module rendered its own hardcoded copies of
 * the same strings, free to drift from them.
 *
 * The colours live in quickPresetData.js (the boot repair reads them too);
 * this adds the labels.
 *
 * @returns {Object} preset key -> { name, shortName, title, swatch, colors }
 */
const quickPresets = () => ({
    default: {
        name: getLabel('preset.defaultFull'),
        shortName: getLabel('preset.default'),
        title: getLabel('preset.defaultDesc'),
        ...QUICK_PRESET_DATA.default
    },
    warm: {
        name: getLabel('preset.warmFull'),
        shortName: getLabel('preset.warm'),
        title: getLabel('preset.warmDesc'),
        ...QUICK_PRESET_DATA.warm
    },
    cool: {
        name: getLabel('preset.coolFull'),
        shortName: getLabel('preset.cool'),
        title: getLabel('preset.coolDesc'),
        ...QUICK_PRESET_DATA.cool
    },
    forest: {
        name: getLabel('preset.forestFull'),
        shortName: getLabel('preset.forest'),
        title: getLabel('preset.forestDesc'),
        ...QUICK_PRESET_DATA.forest
    },
    monochrome: {
        name: getLabel('preset.monoFull'),
        shortName: getLabel('preset.mono'),
        title: getLabel('preset.monoDesc'),
        ...QUICK_PRESET_DATA.monochrome
    },
    professional: {
        name: getLabel('preset.proFull'),
        shortName: getLabel('preset.pro'),
        title: getLabel('preset.proDesc'),
        ...QUICK_PRESET_DATA.professional
    },
    goldenGlow: {
        name: getLabel('preset.goldenFull'),
        shortName: getLabel('preset.golden'),
        title: getLabel('preset.goldenDesc'),
        ...QUICK_PRESET_DATA.goldenGlow
    },
    darkOcean: {
        name: getLabel('preset.oceanFull'),
        shortName: getLabel('preset.ocean'),
        title: getLabel('preset.oceanDesc'),
        ...QUICK_PRESET_DATA.darkOcean
    },
    berry: {
        name: getLabel('preset.berryFull'),
        shortName: getLabel('preset.berry'),
        title: getLabel('preset.berryDesc'),
        ...QUICK_PRESET_DATA.berry
    }
});

// ============================================================================
// QUICK PRESET APPLICATION
// ============================================================================

/**
 * Apply a quick preset theme
 * @param {string} presetKey - The preset key
 * @param {Object} callbacks - { saveColor, resetAllColors, loadSavedColors, updatePreview, applyCustomColors, pushToUndoStack, updateUndoButton, isDefaultTheme, showNotification }
 */
export function applyQuickPreset(presetKey, callbacks) {
    const preset = quickPresets()[presetKey];
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
    // Remember it is a preset: a colour the user picks by hand clears this, and
    // only a hand-picked colour gets the footer strip (preferencesManager).
    callbacks.markPreset?.(presetKey);

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
            <span class="preferences-preset-name" title="${getLabel('preset.renameHint')}">${escapeHtml(preset.name)}</span>
            <div class="preferences-preset-actions">
                <button class="preferences-preset-btn load-btn" title="${getLabel('preset.loadTitle')}">${getLabel('preset.loadAction')}</button>
                <button class="preferences-preset-btn export-btn" title="${getLabel('preset.exportTitle')}">${getLabel('preset.exportAction')}</button>
                <button class="preferences-preset-btn delete-btn" title="${getLabel('preset.deleteTitle')}">${getLabel('preset.deleteAction')}</button>
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
 * Render quick preset buttons dynamically from quickPresets() data.
 * Called by preferencesManager.js before binding click handlers.
 * @param {HTMLElement} container - The grid container element
 */
export function renderQuickPresets(container) {
    if (!container) return;
    container.innerHTML = '';

    Object.entries(quickPresets()).forEach(([key, preset]) => {
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
