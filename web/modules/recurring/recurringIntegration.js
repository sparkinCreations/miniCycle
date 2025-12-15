/**
 * miniCycle Recurring Tasks - Integration Module
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

// ✅ appInit now injected via DI (no static import - enables versioning)

// Module-level dependencies (DI-pure, no window.* fallbacks)
let deps = {
    appInit: null,  // AppInit for initialization coordination
    AppState: null,
    loadMiniCycleData: null,
    showNotification: null,
    showNotificationWithTip: null,
    refreshUIFromState: null,
    updateProgressBar: null,
    FeatureFlags: null,
    notifications: null,
    isOverlayActive: null,
    getDeferredRecurringSetup: null,  // For deferred setup queue
    clearDeferredRecurringSetup: null, // For clearing the queue after processing
    // Utilities for recurringCore and recurringPanel
    GlobalUtils: null,
    escapeHtml: null,
    syncRecurringStateToDOM: null,
    refreshTaskButtonsForModeChange: null
};

/**
 * Set dependencies for RecurringIntegration module.
 * @param {Object} dependencies - Injected dependencies
 */
export function setRecurringIntegrationDependencies(dependencies) {
    deps = { ...deps, ...dependencies };
    console.log('🎯 RecurringIntegration dependencies set:', Object.keys(dependencies));
}

/**
 * Initialize recurring task modules
 * Automatically waits for core systems (AppState + data) to be ready
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.AppMeta - App metadata containing version
 * @returns {Promise<Object>} Object containing core and panel instances
 */
export async function initializeRecurringModules(options = {}) {
    console.log('🔄 Initializing recurring task modules...');

    // ✅ Wait for core systems to be ready (AppState + data)
    await deps.appInit?.waitForCore();
    console.log('✅ Core systems ready - initializing recurring modules');

    try {
        // ============================================
        // STEP 1: Import both modules (with version for cache-busting)
        // ============================================

        // Use injected AppMeta version only (DI-pure)
        if (!options.AppMeta?.version) {
            console.warn('⚠️ recurringIntegration: AppMeta.version not provided');
        }
        const version = options.AppMeta?.version || 'dev-local';
        const recurringCore = await import(`./recurringCore.js?v=${version}`);
        const { RecurringPanelManager, buildRecurringSummaryFromSettings } = await import(`./recurringPanel.js?v=${version}`);

        console.log('✅ Recurring modules imported');

        // ============================================
        // STEP 2: Configure recurringCore dependencies (Strict DI)
        // ============================================

        console.log('🔧 Configuring recurringCore dependencies...');

        recurringCore.setRecurringCoreDependencies({
            // State management (required) - DI-pure
            getAppState: () => {
                if (!deps.AppState) {
                    throw new Error('AppState not available');
                }
                return deps.AppState.get();
            },
            updateAppState: (updateFn, immediate = false) => {
                if (!deps.AppState) {
                    throw new Error('AppState not available');
                }
                return deps.AppState.update(updateFn, immediate);
            },
            isAppStateReady: () => {
                return deps.AppState && deps.AppState.isReady();
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
                console.log(`[Notification] ${message}`);
            },

            // DOM operations (required)
            querySelector: (selector) => document.querySelector(selector),

            // UI callbacks (optional - will be set after panel initialization)
            updateRecurringPanel: null,        // Set later
            updateRecurringSummary: null,      // Set later
            updatePanelButtonVisibility: null, // Set later
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

            // Feature flags (required) - DI-pure
            isEnabled: () => {
                return deps.FeatureFlags?.recurringEnabled !== false;
            },

            // Utilities (DI-pure)
            GlobalUtils: deps.GlobalUtils,
            notifications: deps.notifications,
            showNotificationWithTip: deps.showNotificationWithTip
        });

        console.log('✅ recurringCore dependencies configured');

        // ============================================
        // STEP 3: Initialize RecurringPanelManager (Resilient Constructor)
        // ============================================

        console.log('🎛️ Initializing RecurringPanelManager...');

        const recurringPanel = new RecurringPanelManager({
            // From recurringCore module
            applyRecurringSettings: recurringCore.applyRecurringToTaskSchema25,
            deleteTemplate: recurringCore.deleteRecurringTemplate,
            buildRecurringSummary: buildRecurringSummaryFromSettings,
            normalizeRecurringSettings: recurringCore.normalizeRecurringSettings,
            formatNextOccurrence: recurringCore.formatNextOccurrence,
            calculateNextOccurrence: recurringCore.calculateNextOccurrence,

            // State management - DI-pure
            getAppState: () => deps.AppState?.get(),
            updateAppState: (updateFn, immediate) => deps.AppState?.update(updateFn, immediate),
            isAppStateReady: () => deps.AppState?.isReady(),
            loadData: () => deps.loadMiniCycleData?.(),

            // UI dependencies - DI-pure
            showNotification: (message, type, duration) => {
                if (typeof deps.showNotification === 'function') {
                    return deps.showNotification(message, type, duration);
                }
                console.log(`[Panel Notification] ${message}`);
            },
            showConfirmationModal: (options) => {
                if (typeof deps.notifications?.showConfirmationModal === 'function') {
                    return deps.notifications.showConfirmationModal(options);
                }
                // Fallback to browser confirm
                const confirmed = confirm(options.message);
                if (options.callback) options.callback(confirmed);
            },
            getElementById: (id) => document.getElementById(id),
            querySelector: (selector) => document.querySelector(selector),
            querySelectorAll: (selector) => document.querySelectorAll(selector),

            // Advanced panel dependencies (optional) - DI-pure
            isOverlayActive: () => {
                if (typeof deps.isOverlayActive === 'function') {
                    return deps.isOverlayActive();
                }
                return false;
            },

            // Utilities - DI-pure
            escapeHtml: deps.escapeHtml,
            syncRecurringStateToDOM: deps.syncRecurringStateToDOM,
            refreshTaskButtonsForModeChange: deps.refreshTaskButtonsForModeChange
        });

        console.log('✅ RecurringPanelManager initialized');

        // ============================================
        // STEP 4: Wire up UI callbacks in recurringCore
        // ============================================

        console.log('🔗 Wiring up panel callbacks to core...');

        // Update core dependencies with panel methods
        recurringCore.setRecurringCoreDependencies({
            updateRecurringPanel: () => recurringPanel.updateRecurringPanel(),
            updateRecurringSummary: () => recurringPanel.updateRecurringSummary(),
            updatePanelButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility()
        });

        console.log('✅ Panel callbacks wired to core');

        // ============================================
        // STEP 5: Setup panel UI
        // ============================================

        console.log('⚙️ Setting up recurring panel UI...');

        recurringPanel.setup();

        console.log('✅ Recurring panel UI setup complete');

        // ============================================
        // STEP 6: Setup recurring watcher (30-second interval)
        // ============================================

        console.log('⏱️ Setting up recurring task watcher...');

        // Initialize the watcher - will start checking every 30 seconds
        recurringCore.setupRecurringWatcher();

        console.log('✅ Recurring watcher initialized');

        // ============================================
        // STEP 6.5: Load always-show-recurring setting
        // ============================================

        console.log('⚙️ Loading always-show-recurring setting...');

        // Load the setting after a small delay to ensure DOM is ready
        setTimeout(() => {
            recurringPanel.loadAlwaysShowRecurringSetting();
            console.log('✅ Always-show-recurring setting loaded');
        }, 100);

        // ============================================
        // STEP 6.6: Wire recurring event listeners
        // ============================================
        // These listeners were moved from orchestrator.js for proper module ownership

        recurringPanel.wireAlwaysShowRecurringListener();
        recurringPanel.wireRecurringSettingsClickListener();
        console.log('✅ Recurring event listeners wired');

        // ============================================
        // STEP 7: Build return object (Phase 3 - no window.* exports)
        // ============================================

        // Build convenience objects for direct access
        const recurringCoreAPI = {
            applyRecurringSettings: recurringCore.applyRecurringToTaskSchema25,
            handleActivation: recurringCore.handleRecurringTaskActivation,
            handleDeactivation: recurringCore.handleRecurringTaskDeactivation,
            deleteTemplate: recurringCore.deleteRecurringTemplate,
            removeTasksFromCycle: recurringCore.removeRecurringTasksFromCycle,
            handleAfterReset: recurringCore.handleRecurringTasksAfterReset,
            watchTasks: recurringCore.watchRecurringTasks,
            catchUpMissedTasks: recurringCore.catchUpMissedRecurringTasks,
            // Utility functions
            calculateNextOccurrence: recurringCore.calculateNextOccurrence,
            calculateNextOccurrences: recurringCore.calculateNextOccurrences,
            // Backward compatibility - redirect button visibility to panel
            updateRecurringButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility()
        };

        // Panel functions
        const recurringPanelAPI = {
            updatePanel: () => recurringPanel.updateRecurringPanel(),
            updateSummary: () => recurringPanel.updateRecurringSummary(),
            updateButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility(),
            openPanel: () => recurringPanel.openPanel(),
            closePanel: () => recurringPanel.closePanel(),
            openForTask: (taskId) => recurringPanel.openRecurringSettingsPanelForTask(taskId),
            saveAlwaysShowRecurringSetting: () => recurringPanel.saveAlwaysShowRecurringSetting(),
            loadAlwaysShowRecurringSetting: () => recurringPanel.loadAlwaysShowRecurringSetting()
        };

        // Phase 3 - No window.* exports (main script handles exposure)

        // ============================================
        // STEP 8: Process deferred setups
        // ============================================

        // If there were any deferred recurring setups, run them now (DI-pure)
        const deferredSetups = deps.getDeferredRecurringSetup?.() || [];
        if (deferredSetups.length > 0) {
            console.log('📊 Processing', deferredSetups.length, 'deferred recurring setups');
            deferredSetups.forEach(setupFn => setupFn());
            deps.clearDeferredRecurringSetup?.();
        }

        // ✅ Update recurring button visibility on init (shows button if templates exist)
        setTimeout(() => {
            recurringPanel.updateRecurringPanelButtonVisibility();
            console.log('✅ Recurring button visibility updated on init');
        }, 150);

        console.log('✅ Recurring modules initialized (Phase 3)');

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
            deps.showNotification('Recurring feature initialization failed', 'error', 5000);
        }

        throw error;
    }
}

/**
 * Test function to verify recurring modules are working (DI-pure)
 * @param {Object} recurringModules - The modules object returned from initializeRecurringModules
 * @returns {Object} Test results
 */
export function testRecurringIntegration(recurringModules = null) {
    console.log('🧪 Testing recurring integration (DI-pure)...');

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
        console.log(tests.appStateReady ? '✅' : '❌', 'AppState ready:', tests.appStateReady);
    } catch (e) {
        console.log('❌ AppState check failed:', e.message);
    }

    // Test 2: Core module loaded
    try {
        tests.coreLoaded = recurringModules?.core && typeof recurringModules.core.applyRecurringToTaskSchema25 === 'function';
        console.log(tests.coreLoaded ? '✅' : '❌', 'Core module loaded:', tests.coreLoaded);
    } catch (e) {
        console.log('❌ Core module check failed:', e.message);
    }

    // Test 3: Panel loaded
    try {
        tests.panelLoaded = recurringModules?.panel && typeof recurringModules.panel.updateRecurringPanel === 'function';
        console.log(tests.panelLoaded ? '✅' : '❌', 'Panel module loaded:', tests.panelLoaded);
    } catch (e) {
        console.log('❌ Panel module check failed:', e.message);
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
        console.log(tests.coreAPIComplete ? '✅' : '❌', 'Core API complete:', tests.coreAPIComplete);
    } catch (e) {
        console.log('❌ Core API check failed:', e.message);
    }

    // Test 5: Panel API complete
    try {
        const requiredPanelFunctions = [
            'updatePanel',
            'updateSummary',
            'updateButtonVisibility',
            'openPanel',
            'closePanel',
            'openForTask'
        ];
        tests.panelAPIComplete = recurringModules?.panelAPI &&
            requiredPanelFunctions.every(fn => typeof recurringModules.panelAPI[fn] === 'function');
        console.log(tests.panelAPIComplete ? '✅' : '❌', 'Panel API complete:', tests.panelAPIComplete);
    } catch (e) {
        console.log('❌ Panel API check failed:', e.message);
    }

    // Summary
    const allPassed = Object.values(tests).every(t => t === true);
    console.log('\n' + '='.repeat(50));
    console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('='.repeat(50));

    return tests;
}

// Phase 3 - testRecurringIntegration exported via ES modules, DI-pure

console.log('🔗 Recurring integration module loaded (Phase 3)');
