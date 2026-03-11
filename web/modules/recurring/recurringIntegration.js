/**
 * miniCycle Recurring Tasks - Integration Module (DI-Pure)
 *
 * This module demonstrates how to integrate recurringCore and recurringPanel
 * into the main miniCycle application.
 *
 * This is a REFERENCE IMPLEMENTATION showing the proper integration pattern.
 * Copy this code into miniCycle-scripts.js DOMContentLoaded handler.
 *
 * @module recurringIntegration
 * @requires AppInit (for initialization coordination)
 */

import { createDIModule, optional } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';

import { UI_TIMEOUTS } from '../core/constants.js';
// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RecurringIntegration', {
    appInit: optional(null),
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    showNotification: optional(null),
    showNotificationWithTip: optional(null),
    refreshUIFromState: optional(null),
    updateProgressBar: optional(null),
    FeatureFlags: optional(null),
    notifications: optional(null),
    isOverlayActive: optional(null),
    getDeferredRecurringSetup: optional(null),
    clearDeferredRecurringSetup: optional(null),
    GlobalUtils: optional(null),
    escapeHtml: optional(null),
    syncRecurringStateToDOM: optional(null),
    refreshTaskButtonsForModeChange: optional(null)
});

// Late-binding deps via Proxy
const deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for RecurringIntegration module.
 * @param {Object} dependencies - Injected dependencies
 */
export function setRecurringIntegrationDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Initialize recurring task modules
 * Automatically waits for core systems (AppState + data) to be ready
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.AppMeta - App metadata containing version
 * @returns {Promise<Object>} Object containing core and panel instances
 */
export async function initRecurringModules(options = {}) {

    // Populate DI container from moduleLoader-provided dependencies
    di.setDependencies(options);

    // ✅ Wait for core systems to be ready (AppState + data)
    await deps.appInit?.waitForCore();

    try {
        // ============================================
        // STEP 1: Import both modules (with version for cache-busting)
        // ============================================

        const version = options.AppMeta?.version || globalThis.APP_VERSION;
        if (!options.AppMeta?.version) {
            console.warn('⚠️ recurringIntegration: AppMeta.version not provided, using globalThis fallback');
        }
        const recurringCore = await import(`./recurringCore.js?v=${version}`);
        const { RecurringPanelManager, setRecurringPanelDependencies, buildRecurringSummaryFromSettings, loadPanelSubModules } = await import(`./recurringPanel.js?v=${version}`);
        const settingsApplicator = await import(`./recurringSettingsApplicator.js?v=${version}`);

        // Load panel sub-modules with version cache-busting
        await loadPanelSubModules(version);

        // ============================================
        // STEP 2: Configure recurringCore dependencies (Strict DI)
        // ============================================

        // Capture returned functions (workaround for dynamic import binding issues)
        const coreFunctions = await recurringCore.setRecurringCoreDependencies({
            // Version for cache-busting sub-module imports
            AppMeta: options.AppMeta,

            // State management (required) - DI-pure (pass AppState directly)
            AppState: deps.AppState,
            updateAppState: (updateFn, immediate = false) => {
                if (!deps.AppState) {
                    throw new Error('AppState not available');
                }
                return deps.AppState.update(updateFn, immediate);
            },

            // Data operations (legacy - for backwards compatibility)
            loadData: () => {
                if (typeof deps.loadMiniCycleData !== 'function') {
                    console.warn('⚠️ loadMiniCycleData not available');
                    return null;
                }
                return deps.loadMiniCycleData();
            },

            // Notifications (required) - DI-pure
            showNotification: (message, type, duration) => {
                if (typeof deps.showNotification === 'function') {
                    return deps.showNotification(message, type, duration);
                }
            },

            // DOM operations (required)
            querySelector: (selector) => document.querySelector(selector),

            // UI callbacks (optional - will be set after panel initialization)
            updateRecurringPanel: null,        // Set later
            updateRecurringSummary: null,      // Set later
            updatePanelButtonVisibility: null, // Set later
            updateInfoLink: null,             // Set later
            refreshUIFromState: () => {
                if (typeof deps.refreshUIFromState === 'function') {
                    return deps.refreshUIFromState();
                }
                console.warn('⚠️ refreshUIFromState not available');
            },
            updateProgressBar: () => {
                if (typeof deps.updateProgressBar === 'function') {
                    return deps.updateProgressBar();
                }
                console.warn('⚠️ updateProgressBar not available');
            },

            // Time/scheduling (required)
            now: () => Date.now(),
            setInterval: (fn, ms) => setInterval(fn, ms),
            clearInterval: (id) => clearInterval(id),

            // Feature flags (required) - DI-pure
            isEnabled: () => {
                return deps.FeatureFlags?.recurringEnabled !== false;
            },

            // Utilities (DI-pure)
            GlobalUtils: deps.GlobalUtils,
            notifications: deps.notifications,
            showNotificationWithTip: deps.showNotificationWithTip
        });

        // ============================================
        // STEP 2.5: Configure settingsApplicator dependencies
        // ============================================

        settingsApplicator.setRecurringSettingsApplicatorDependencies({
            appInit: deps.appInit,
            AppState: deps.AppState,
            showNotification: deps.showNotification,
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (selector) => document.querySelectorAll(selector),
            normalizeRecurringSettings: coreFunctions.normalizeRecurringSettings,
            calculateNextOccurrence: coreFunctions.calculateNextOccurrence,
            updateAppState: (updateFn, immediate) => deps.AppState?.update(updateFn, immediate),
            syncRecurringStateToDOM: deps.syncRecurringStateToDOM,
            restartRecurringWatcher: coreFunctions.restartRecurringWatcher
        });

        // ============================================
        // STEP 3: Initialize RecurringPanelManager (Strict DI)
        // ============================================

        // Wire module-level dependencies BEFORE creating instance
        setRecurringPanelDependencies({
            // Required (panel throws at boot if any are missing)
            AppState: deps.AppState,
            showNotification: deps.showNotification,
            applyRecurringSettings: settingsApplicator.applyRecurringSettings,
            normalizeRecurringSettings: coreFunctions.normalizeRecurringSettings,
            calculateNextOccurrence: coreFunctions.calculateNextOccurrence,
            deleteTemplate: coreFunctions.deleteRecurringTemplate,
            buildRecurringSummary: buildRecurringSummaryFromSettings,
            formatNextOccurrence: coreFunctions.formatNextOccurrence,
            updateAppState: (updateFn, immediate) => deps.AppState?.update(updateFn, immediate),
            showConfirmationModal: (options) => deps.notifications?.showConfirmationModal(options),
            getElementById: (id) => document.getElementById(id),
            querySelector: (selector) => document.querySelector(selector),
            querySelectorAll: (selector) => document.querySelectorAll(selector),

            // Optional (nullable — panel checks before use)
            appInit: deps.appInit,
            loadData: () => deps.loadMiniCycleData?.(),
            safeAddEventListener: deps.GlobalUtils?.safeAddEventListener,
            escapeHtml: deps.escapeHtml,
            syncRecurringStateToDOM: deps.syncRecurringStateToDOM,
            refreshTaskButtonsForModeChange: deps.refreshTaskButtonsForModeChange,
            refreshUIFromState: () => deps.refreshUIFromState?.(),
            activateTaskRecurringState: coreFunctions.activateTaskRecurringState,
            deactivateTaskRecurringState: coreFunctions.deactivateTaskRecurringState,
            getModal: deps.getModal
        });

        // Create instance - will validate required deps via DI
        const recurringPanel = new RecurringPanelManager();

        // ============================================
        // STEP 4: Wire up UI callbacks in recurringCore
        // ============================================

        // Update core dependencies with panel methods
        await recurringCore.setRecurringCoreDependencies({
            updateRecurringPanel: () => recurringPanel.updateRecurringPanel(),
            updateRecurringSummary: () => recurringPanel.updateRecurringSummary(),
            updatePanelButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility(),
            updateInfoLink: () => recurringPanel.updateRecurringInfoLink()
        });

        // ============================================
        // STEP 5: Setup panel UI
        // ============================================

        recurringPanel.setup();

        // ============================================
        // STEP 6: Setup recurring watcher (30-second interval)
        // ============================================

        // Initialize the watcher - will start checking every 30 seconds
        await coreFunctions.setupRecurringWatcher();

        // ============================================
        // STEP 6.5: Wire recurring event listeners
        // ============================================

        recurringPanel.wireRecurringSettingsClickListener();

        // ============================================
        // STEP 7: Build return object (Phase 3 - no window.* exports)
        // ============================================

        // Build convenience objects for direct access (use coreFunctions for loaded values)
        const recurringCoreAPI = {
            applyRecurringSettings: coreFunctions.applyRecurringToTaskSchema25,
            handleActivation: coreFunctions.handleRecurringTaskActivation,
            handleDeactivation: coreFunctions.handleRecurringTaskDeactivation,
            deleteTemplate: coreFunctions.deleteRecurringTemplate,
            removeTasksFromCycle: coreFunctions.removeRecurringTasksFromCycle,
            handleAfterReset: coreFunctions.handleRecurringTasksAfterReset,
            watchTasks: coreFunctions.watchRecurringTasks,
            catchUpMissedTasks: coreFunctions.catchUpMissedRecurringTasks,
            // Utility functions
            calculateNextOccurrence: coreFunctions.calculateNextOccurrence,
            calculateNextOccurrences: coreFunctions.calculateNextOccurrences,
            // Backward compatibility - redirect button visibility to panel
            updateRecurringButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility()
        };

        // Panel functions
        const recurringPanelAPI = {
            updatePanel: () => recurringPanel.updateRecurringPanel(),
            updateSummary: () => recurringPanel.updateRecurringSummary(),
            updateButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility(),
            updateInfoLink: () => recurringPanel.updateRecurringInfoLink(),
            openPanel: () => recurringPanel.openPanel(),
            closePanel: () => recurringPanel.closePanel(),
            openForTask: (taskId) => recurringPanel.openRecurringSettingsPanelForTask(taskId),
        };

        // Phase 3 - No window.* exports (main script handles exposure)

        // ============================================
        // STEP 8: Process deferred setups
        // ============================================

        // If there were any deferred recurring setups, run them now (DI-pure)
        const deferredSetups = deps.getDeferredRecurringSetup?.() || [];
        if (deferredSetups.length > 0) {
            deferredSetups.forEach(setupFn => setupFn());
            deps.clearDeferredRecurringSetup?.();
        }

        // ✅ Update recurring button visibility and info link on init (shows button if templates exist)
        setTimeout(() => {
            recurringPanel.updateRecurringPanelButtonVisibility();
            recurringPanel.updateRecurringInfoLink();
        }, 150);

        return {
            core: recurringCore,
            panel: recurringPanel,
            manager: recurringPanel,
            // API wrappers for window exposure
            coreAPI: recurringCoreAPI,
            panelAPI: recurringPanelAPI
        };

    } catch (error) {
        console.error('❌ Failed to initialize recurring modules:', error);

        // Show user-facing error - DI-pure
        if (typeof deps.showNotification === 'function') {
            deps.showNotification(getLabel('notify.recurringInitFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_SLOW);
        }

        throw error;
    }
}

/**
 * Test function to verify recurring modules are working (DI-pure)
 * @param {Object} recurringModules - The modules object returned from initRecurringModules
 * @returns {Object} Test results
 */
export function testRecurringIntegration(recurringModules = null) {

    const tests = {
        appStateReady: false,
        coreLoaded: false,
        panelLoaded: false,
        coreAPIComplete: false,
        panelAPIComplete: false
    };

    // Test 1: AppState ready (via deps)
    try {
        tests.appStateReady = deps.AppState && deps.AppState.isReady();
    } catch (e) {
    }

    // Test 2: Core module loaded
    try {
        tests.coreLoaded = recurringModules?.core && typeof recurringModules.core.applyRecurringToTaskSchema25 === 'function';
    } catch (e) {
    }

    // Test 3: Panel loaded
    try {
        tests.panelLoaded = recurringModules?.panel && typeof recurringModules.panel.updateRecurringPanel === 'function';
    } catch (e) {
    }

    // Test 4: Core API complete
    try {
        const requiredCoreFunctions = [
            'applyRecurringSettings',
            'handleActivation',
            'handleDeactivation',
            'deleteTemplate',
            'removeTasksFromCycle'
        ];
        tests.coreAPIComplete = recurringModules?.coreAPI &&
            requiredCoreFunctions.every(fn => typeof recurringModules.coreAPI[fn] === 'function');
    } catch (e) {
    }

    // Test 5: Panel API complete
    try {
        const requiredPanelFunctions = [
            'updatePanel',
            'updateSummary',
            'updateButtonVisibility',
            'updateInfoLink',
            'openPanel',
            'closePanel',
            'openForTask'
        ];
        tests.panelAPIComplete = recurringModules?.panelAPI &&
            requiredPanelFunctions.every(fn => typeof recurringModules.panelAPI[fn] === 'function');
    } catch (e) {
    }

    // Summary
    const allPassed = Object.values(tests).every(t => t === true);

    return tests;
}

// Phase 3 - testRecurringIntegration exported via ES modules, DI-pure

