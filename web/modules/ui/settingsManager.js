/**
 * Settings Manager Facade (DI-Pure)
 * Orchestrates settings sub-modules for import/export, backup/restore, and UI controls
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 * Uses dynamic versioned imports to avoid duplicate module loading
 *
 * @module ui/settingsManager
 * @pattern Facade
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// MODULE-LEVEL STORAGE (populated by dynamic imports)
// ============================================================================

let _subModules = null;
let _initialized = false;

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('SettingsManager', {
    appInit: optional(null),
    loadMiniCycleData: required(),
    AppState: required(),
    showNotification: required(),
    showConfirmationModal: required(),
    hideMainMenu: optional(null),
    setupDarkModeToggle: optional(null),
    setupQuickDarkToggle: optional(null),
    updateMoveArrowsVisibility: optional(null),
    toggleHoverTaskOptions: optional(null),
    refreshTaskListUI: optional(null),
    performSchema25Migration: optional(null),
    resetDefaultRecurringSettings: optional(null),
    organizeCompletedTasks: optional(null),
    updateStatsPanel: optional(null),
    DataValidator: optional(null),
    calculateNextOccurrence: optional(null),
    sanitizeInput: required(),
    AppMeta: optional(null),
    safeAddEventListener: required(),
    BackupManager: optional(null),
    enableDebug: optional(null),
    disableDebug: optional(null),
    isDebug: optional(null),
    clearAllUndoHistory: optional(null),
    updateHelpWindow: optional(null)
});

/** @type {{appInit: Object|null, loadMiniCycleData: Function, AppState: Object, showNotification: Function, showConfirmationModal: Function, hideMainMenu: Function|null, setupDarkModeToggle: Function|null, setupQuickDarkToggle: Function|null, updateMoveArrowsVisibility: Function|null, toggleHoverTaskOptions: Function|null, refreshTaskListUI: Function|null, performSchema25Migration: Function|null, resetDefaultRecurringSettings: Function|null, organizeCompletedTasks: Function|null, DataValidator: Object|null, calculateNextOccurrence: Function|null, sanitizeInput: Function, AppMeta: Object|null, safeAddEventListener: Function, BackupManager: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for SettingsManager and all sub-modules
 * @param {Object} dependencies - All required dependencies
 */
export function setSettingsManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('SettingsManager dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// DYNAMIC SUB-MODULE LOADING (versioned imports)
// ============================================================================

/**
 * Load all sub-modules with versioned imports
 * @param {string} version - Version string for cache busting
 */
async function loadSubModules(version) {
    if (_subModules) return _subModules;

    console.log(`📦 SettingsManager: Loading sub-modules with version ${version}`);

    const [
        settingsUIModule,
        cycleExportModule,
        cycleImportModule,
        backupRestoreModule,
        dataSanitizerModule,
        shareModule
    ] = await Promise.all([
        import(`./settingsUIManager.js?v=${version}`),
        import(`./cycleExportManager.js?v=${version}`),
        import(`./cycleImportManager.js?v=${version}`),
        import(`./backupRestoreManager.js?v=${version}`),
        import(`../utils/dataSanitizer.js?v=${version}`),
        import(`./shareManager.js?v=${version}`)
    ]);

    // Initialize modules that need dynamic utility imports
    if (typeof cycleImportModule.initCycleImportManager === 'function') {
        await cycleImportModule.initCycleImportManager();
    }

    // New settings toggles: add them ONLY in settingsUIManager.initAllToggles().
    // init() below calls initAllToggles() as a single batch — no per-toggle
    // registration needed here. Non-toggle sub-module functions (export,
    // import, backup) still need individual registration below.
    _subModules = {
        // Settings UI
        setSettingsUIManagerDependencies: settingsUIModule.setSettingsUIManagerDependencies,
        _resetForTesting: settingsUIModule._resetForTesting,
        setupSettingsMenu: settingsUIModule.setupSettingsMenu,
        setupDarkModeToggle: settingsUIModule.setupDarkModeToggle,
        setupMoveArrowsToggle: settingsUIModule.setupMoveArrowsToggle,
        setupThreeDotsToggle: settingsUIModule.setupThreeDotsToggle,
        setupCompletedDropdownToggle: settingsUIModule.setupCompletedDropdownToggle,
        setupHelpWindowToggle: settingsUIModule.setupHelpWindowToggle,
        setupQuickActionsToggle: settingsUIModule.setupQuickActionsToggle,
        setupScrollToNewTaskToggle: settingsUIModule.setupScrollToNewTaskToggle,
        setupScrollOnLoadToggle: settingsUIModule.setupScrollOnLoadToggle,
        setupDebugModeToggle: settingsUIModule.setupDebugModeToggle,
        setupResetRecurringButton: settingsUIModule.setupResetRecurringButton,
        setupResetAchievementProgressButton: settingsUIModule.setupResetAchievementProgressButton,
        setupClearUndoHistoryButton: settingsUIModule.setupClearUndoHistoryButton,
        syncCurrentSettingsToStorage: settingsUIModule.syncCurrentSettingsToStorage,
        initAllToggles: settingsUIModule.initAllToggles,

        // Cycle Export
        setCycleExportManagerDependencies: cycleExportModule.setCycleExportManagerDependencies,
        setupExportButton: cycleExportModule.setupExportButton,
        exportMiniCycleData: cycleExportModule.exportMiniCycleData,

        // Cycle Import
        setCycleImportManagerDependencies: cycleImportModule.setCycleImportManagerDependencies,
        setupImportButtons: cycleImportModule.setupImportButtons,
        setupDragDropImport: cycleImportModule.setupDragDropImport,

        // Backup/Restore
        setBackupRestoreManagerDependencies: backupRestoreModule.setBackupRestoreManagerDependencies,
        setupBackupButton: backupRestoreModule.setupBackupButton,
        setupRestoreButton: backupRestoreModule.setupRestoreButton,
        setupFactoryResetButton: backupRestoreModule.setupFactoryResetButton,
        neutralizeAppState: backupRestoreModule.neutralizeAppState,

        // Data Sanitizer
        setDataSanitizerDependencies: dataSanitizerModule.setDataSanitizerDependencies,
        sanitizeImportedData: dataSanitizerModule.sanitizeImportedData,
        sanitizeText: dataSanitizerModule.sanitizeText,

        // Share
        setShareManagerDependencies: shareModule.setShareManagerDependencies,
        setupShareRoutineButton: shareModule.setupShareRoutineButton,
        setupShareAppButton: shareModule.setupShareAppButton
    };

    console.log('✅ SettingsManager: All sub-modules loaded');
    return _subModules;
}

/**
 * Wire dependencies to all sub-modules
 * @param {Object} dependencies - Dependencies to propagate
 */
function wireSubModuleDependencies(dependencies) {
    if (!_subModules) {
        console.error('SettingsManager: Sub-modules not loaded yet');
        return;
    }

    _subModules.setSettingsUIManagerDependencies({
        AppState: dependencies.AppState,
        loadMiniCycleData: dependencies.loadMiniCycleData,
        showNotification: dependencies.showNotification,
        safeAddEventListener: dependencies.safeAddEventListener,
        showConfirmationModal: dependencies.showConfirmationModal,
        hideMainMenu: dependencies.hideMainMenu,
        setupDarkModeToggle: dependencies.setupDarkModeToggle,
        setupQuickDarkToggle: dependencies.setupQuickDarkToggle,
        updateMoveArrowsVisibility: dependencies.updateMoveArrowsVisibility,
        toggleHoverTaskOptions: dependencies.toggleHoverTaskOptions,
        refreshTaskListUI: dependencies.refreshTaskListUI,
        organizeCompletedTasks: dependencies.organizeCompletedTasks,
        resetDefaultRecurringSettings: dependencies.resetDefaultRecurringSettings,
        updateStatsPanel: dependencies.updateStatsPanel,
        enableDebug: dependencies.enableDebug,
        disableDebug: dependencies.disableDebug,
        isDebug: dependencies.isDebug,
        clearAllUndoHistory: dependencies.clearAllUndoHistory,
        updateHelpWindow: dependencies.updateHelpWindow
    });

    _subModules.setCycleExportManagerDependencies({
        loadMiniCycleData: dependencies.loadMiniCycleData,
        showNotification: dependencies.showNotification,
        showConfirmationModal: dependencies.showConfirmationModal,
        safeAddEventListener: dependencies.safeAddEventListener,
        AppMeta: dependencies.AppMeta
    });

    _subModules.setCycleImportManagerDependencies({
        loadMiniCycleData: dependencies.loadMiniCycleData,
        AppState: dependencies.AppState,
        showNotification: dependencies.showNotification,
        showChoiceModal: dependencies.showChoiceModal,
        safeAddEventListener: dependencies.safeAddEventListener,
        DataValidator: dependencies.DataValidator,
        calculateNextOccurrence: dependencies.calculateNextOccurrence,
        AppMeta: dependencies.AppMeta,
        vocabThemeManager: dependencies.vocabThemeManager
    });

    _subModules.setBackupRestoreManagerDependencies({
        AppState: dependencies.AppState,
        showNotification: dependencies.showNotification,
        showConfirmationModal: dependencies.showConfirmationModal,
        safeAddEventListener: dependencies.safeAddEventListener,
        performSchema25Migration: dependencies.performSchema25Migration,
        BackupManager: dependencies.BackupManager,
        AppMeta: dependencies.AppMeta
    });

    _subModules.setDataSanitizerDependencies({
        sanitizeInput: dependencies.sanitizeInput
    });

    _subModules.setShareManagerDependencies({
        loadMiniCycleData: dependencies.loadMiniCycleData,
        showNotification: dependencies.showNotification,
        safeAddEventListener: dependencies.safeAddEventListener,
        hideMainMenu: dependencies.hideMainMenu
    });

    console.log('✅ SettingsManager: Sub-module dependencies wired');
}

// ============================================================================
// SETTINGS MANAGER CLASS (Facade)
// ============================================================================

export class SettingsManager {
    constructor(dependencies = {}) {
        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = dependencies.AppMeta?.version || _deps.AppMeta?.version;
        this.initialized = false;
    }

    /**
     * Initialize settings manager and all sub-modules
     */
    async init() {
        if (this.initialized) return;

        // Wait for core systems
        await _deps.appInit?.waitForCore?.();

        try {
            // Load sub-modules with versioned imports
            await loadSubModules(this.version);

            // Wire dependencies to sub-modules
            wireSubModuleDependencies(di.resolve());

            // Initialize all settings UI toggles via batch function.
            // New toggles only need to be added in settingsUIManager.initAllToggles().
            _subModules.initAllToggles?.();

            // Initialize non-toggle sub-modules (export, import, backup)
            _subModules.setupExportButton?.();
            _subModules.setupImportButtons?.();
            _subModules.setupDragDropImport?.();
            _subModules.setupBackupButton?.();
            _subModules.setupRestoreButton?.();
            _subModules.setupFactoryResetButton?.();
            _subModules.setupShareRoutineButton?.();
            _subModules.setupShareAppButton?.();

            this.initialized = true;
            _initialized = true;
            console.log('✅ Settings Manager initialized');
        } catch (error) {
            console.warn('Settings Manager initialization failed:', error);
            _deps.showNotification?.(getLabel('notify.settingsLimited'), 'warning');
        }
    }

    // Delegate to sub-modules for backwards compatibility
    neutralizeAppState() {
        _subModules?.neutralizeAppState?.();
    }

    setupSettingsMenu() {
        _subModules?.setupSettingsMenu?.();
    }

    setupDownloadMiniCycle() {
        _subModules?.setupExportButton?.();
    }

    setupUploadMiniCycle() {
        _subModules?.setupImportButtons?.();
    }

    async syncCurrentSettingsToStorage() {
        await _subModules?.syncCurrentSettingsToStorage?.();
    }

    exportMiniCycleData(data, name) {
        _subModules?.exportMiniCycleData?.(data, name);
    }

    sanitizeImportedData(backupData) {
        return _subModules?.sanitizeImportedData?.(backupData);
    }

    async resetDefaultRecurringSettings() {
        console.log('Resetting recurring defaults...');

        const defaultSettings = {
            frequency: "daily",
            indefinitely: true,
            time: null
        };

        const AppState = _deps.AppState?.();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.defaultRecurringSettings = defaultSettings;
            }, true);
            _deps.showNotification?.(getLabel('notify.recurringDefaultReset'), "success");
        } else {
            console.error('AppState not ready - settings not saved');
            _deps.showNotification?.(getLabel('notify.resetDefaultsFailed'), "error");
        }
    }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

// Create singleton instance
let settingsManager = null;

/**
 * Initialize settings manager
 * @param {Object} dependencies - Dependencies for the manager
 * @returns {Promise<SettingsManager>} Initialized manager instance
 */
export async function initSettingsManager(dependencies) {
    settingsManager = new SettingsManager(dependencies);
    await settingsManager.init();
    return settingsManager;
}

// ============================================================================
// RE-EXPORTS (async getters for sub-module functions)
// ============================================================================

// These are async because sub-modules are loaded dynamically
export async function getSubModules(version) {
    return await loadSubModules(version || _deps.AppMeta?.version);
}

// Synchronous getters (only work after init)
export function setupSettingsMenu() { _subModules?.setupSettingsMenu?.(); }
export function setupDarkModeToggle() { _subModules?.setupDarkModeToggle?.(); }
export function setupMoveArrowsToggle() { _subModules?.setupMoveArrowsToggle?.(); }
export function setupThreeDotsToggle() { _subModules?.setupThreeDotsToggle?.(); }
export function setupCompletedDropdownToggle() { _subModules?.setupCompletedDropdownToggle?.(); }
export function setupScrollToNewTaskToggle() { _subModules?.setupScrollToNewTaskToggle?.(); }
export function setupScrollOnLoadToggle() { _subModules?.setupScrollOnLoadToggle?.(); }
export function setupDebugModeToggle() { _subModules?.setupDebugModeToggle?.(); }
export function setupResetRecurringButton() { _subModules?.setupResetRecurringButton?.(); }
export function setupResetAchievementProgressButton() { _subModules?.setupResetAchievementProgressButton?.(); }
export function setupClearUndoHistoryButton() { _subModules?.setupClearUndoHistoryButton?.(); }
export function syncCurrentSettingsToStorage() { return _subModules?.syncCurrentSettingsToStorage?.(); }
export function initAllToggles() { _subModules?.initAllToggles?.(); }
export function setupExportButton() { _subModules?.setupExportButton?.(); }
export function exportMiniCycleData(data, name) { _subModules?.exportMiniCycleData?.(data, name); }
export function setupImportButtons() { _subModules?.setupImportButtons?.(); }
export function setupBackupButton() { _subModules?.setupBackupButton?.(); }
export function setupRestoreButton() { _subModules?.setupRestoreButton?.(); }
export function setupFactoryResetButton() { _subModules?.setupFactoryResetButton?.(); }
export function neutralizeAppState() { _subModules?.neutralizeAppState?.(); }
export function sanitizeImportedData(data) { return _subModules?.sanitizeImportedData?.(data); }
export function sanitizeText(text, maxLen) { return _subModules?.sanitizeText?.(text, maxLen); }
export function _resetForTesting() { _subModules?._resetForTesting?.(); }
export function setupShareRoutineButton() { _subModules?.setupShareRoutineButton?.(); }
export function setupShareAppButton() { _subModules?.setupShareAppButton?.(); }

console.log('Settings Manager loaded (facade pattern with dynamic versioned imports)');
