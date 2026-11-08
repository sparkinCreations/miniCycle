/**
 * Quick preset data — the built-in colour presets, without their labels.
 *
 * Pure data, no imports. Two readers:
 *   - ui/preferencesPresets.js adds each preset's labels (getLabel, resolved per
 *     call) and renders and applies them in Personalization.
 *   - routine/schemaMigration26.js (retireLegacyColorTheme) applies the Golden or
 *     Ocean preset at boot to a user whose stored colour theme was golden-glow or
 *     dark-ocean, the themes these two presets were made from.
 *
 * It is its own file so the boot repair can read the colours without importing
 * preferencesPresets, a sub-module preferencesManager loads dynamically with
 * `?v=` (a static import of it from boot code would be a second instance).
 * Static imports from appState make this file boot-critical: it is in
 * BOOT_CRITICAL in service-worker.js.
 *
 * @module ui/quickPresetData
 */

/**
 * Keys allowed in a preset's colors object. A preset import keeps only these
 * (plus the boolean and number keys in preferencesPresets); a user "has custom
 * colours" when settings.customColors holds any of them.
 */
export const PRESET_COLOR_KEYS = Object.freeze([
    'appBg', 'taskListBg', 'taskBg', 'taskText', 'titleBg', 'titleText',
    'checkboxBg', 'checkboxIncompleteBg', 'checkmark', 'completeBtn',
    'clearBtn', 'progressBar', 'cornerBtn', 'statsBg', 'statsText', 'statsProgress',
    'statsDoughnut', 'panelText', 'patternColor'
]);

/**
 * preset key -> { swatch: [appBg, listBg], colors: { colorKey: hex } }.
 * `default` has no colours: applying it is Reset All.
 */
export const QUICK_PRESET_DATA = Object.freeze({
    default: Object.freeze({
        swatch: Object.freeze(['#4c79ff', '#ffffff']),
        colors: Object.freeze({})
    }),
    warm: Object.freeze({
        swatch: Object.freeze(['#ff6b6b', '#ffeaa7']),
        colors: Object.freeze({
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
        })
    }),
    cool: Object.freeze({
        swatch: Object.freeze(['#74b9ff', '#e8f8f5']),
        colors: Object.freeze({
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
        })
    }),
    forest: Object.freeze({
        swatch: Object.freeze(['#2d5016', '#d4edda']),
        colors: Object.freeze({
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
        })
    }),
    monochrome: Object.freeze({
        swatch: Object.freeze(['#2d3436', '#dfe6e9']),
        colors: Object.freeze({
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
        })
    }),
    professional: Object.freeze({
        swatch: Object.freeze(['#007aff', '#b7c3d1']),
        colors: Object.freeze({
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
        })
    }),
    goldenGlow: Object.freeze({
        swatch: Object.freeze(['#d4a017', '#fffef5']),
        colors: Object.freeze({
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
        })
    }),
    darkOcean: Object.freeze({
        swatch: Object.freeze(['#0a2540', '#1a3a5c']),
        colors: Object.freeze({
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
        })
    }),
    berry: Object.freeze({
        swatch: Object.freeze(['#7c3aed', '#faf5ff']),
        colors: Object.freeze({
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
        })
    })
});
