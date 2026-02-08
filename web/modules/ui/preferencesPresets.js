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

import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEFAULT COLORS (needed for reset-to-default in quick presets)
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
    callbacks.showNotification?.(getLabel('notify.themeApplied', { vars: { name: preset.name } }), 'success', 2000);
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
            title: 'Save Preset',
            message: 'Enter a name for this color preset:',
            placeholder: 'My Custom Theme',
            confirmText: 'Save',
            cancelText: 'Cancel',
            required: true,
            callback: (name) => {
                if (name && name.trim()) {
                    savePreset(name.trim(), deps, renderPresetsList);
                }
            }
        });
    } else {
        // Fallback to native prompt
        const name = prompt('Enter a name for this preset:');
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
    const currentColors = { ...state?.settings?.customColors } || {};

    // Create new preset
    const preset = {
        id: Date.now().toString(),
        name: name,
        colors: currentColors,
        createdAt: Date.now()
    };

    deps.AppState.update(state => {
        if (!state.settings.savedColorPresets) {
            state.settings.savedColorPresets = [];
        }
        state.settings.savedColorPresets.push(preset);
    });

    renderPresetsList();
    deps.showNotification?.(getLabel('notify.presetSaved', { vars: { name } }), 'success', 2000);
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
        deps.showNotification?.(getLabel('notify.presetNotFound'), 'error', 2000);
        return;
    }

    callbacks.pushToUndoStack();

    deps.AppState.update(state => {
        state.settings.customColors = { ...preset.colors };
    });

    callbacks.loadSavedColors();
    callbacks.updatePreview();
    callbacks.applyCustomColors();
    callbacks.updateUndoButton();

    deps.showNotification?.(getLabel('notify.presetLoaded', { vars: { name: preset.name } }), 'success', 2000);
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
    deps.showNotification?.(getLabel('notify.presetRenamed'), 'success', 2000);
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
        deps.showNotification?.(getLabel('notify.presetDeleted'), 'info', 2000);
    };

    if (deps.showConfirmationModal) {
        deps.showConfirmationModal({
            title: 'Delete Preset',
            message: `Are you sure you want to delete "${preset.name}"?`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            destructive: true,
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
        version: 1
    };

    // Fix #42: Handle Unicode characters that btoa can't encode
    const jsonStr = JSON.stringify(exportData);
    const code = btoa(unescape(encodeURIComponent(jsonStr)));

    // Try to copy to clipboard
    navigator.clipboard.writeText(code).then(() => {
        deps.showNotification?.(getLabel('notify.presetCopied'), 'success', 3000);
    }).catch(() => {
        // Fallback: show code in a modal for manual copying
        if (deps.showPromptModal) {
            deps.showPromptModal({
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
 * @param {Object} deps - Dependencies { AppState, showPromptModal, showNotification }
 * @param {Function} renderPresetsList - Callback to re-render presets list
 */
export function promptImportPreset(deps, renderPresetsList) {
    if (deps.showPromptModal) {
        deps.showPromptModal({
            title: 'Import Preset',
            message: 'Paste the preset code you received:',
            placeholder: 'Paste code here...',
            confirmText: 'Import',
            cancelText: 'Cancel',
            required: true,
            callback: (code) => {
                if (code && code.trim()) {
                    importPreset(code.trim(), deps, renderPresetsList);
                }
            }
        });
    } else {
        // Fallback to native prompt
        const code = prompt('Paste the preset code:');
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
        const data = JSON.parse(atob(code));

        if (!data.name || !data.colors) {
            throw new Error('Invalid preset format');
        }

        // Save as new preset
        if (!deps.AppState) return;

        const preset = {
            id: Date.now().toString(),
            name: data.name + ' (imported)',
            colors: data.colors,
            createdAt: Date.now()
        };

        deps.AppState.update(state => {
            if (!state.settings.savedColorPresets) {
                state.settings.savedColorPresets = [];
            }
            state.settings.savedColorPresets.push(preset);
        });

        renderPresetsList();
        deps.showNotification?.(getLabel('notify.presetImported', { vars: { name: data.name } }), 'success', 2000);

    } catch (error) {
        deps.showNotification?.(getLabel('notify.invalidPreset'), 'error', 2000);
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
    const swatchColors = [
        colors.appBg || DEFAULT_COLORS.appBg,
        colors.taskListBg || DEFAULT_COLORS.taskListBg,
        colors.checkboxBg || DEFAULT_COLORS.checkboxBg,
        colors.completeBtn || DEFAULT_COLORS.completeBtn
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
