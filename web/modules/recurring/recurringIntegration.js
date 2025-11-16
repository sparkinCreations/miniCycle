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
 * @version 1.368
 * @requires AppInit (for initialization coordination)
 */

import { appInit } from '../core/appInit.js';

/**
 * Initialize recurring task modules
 * Automatically waits for core systems (AppState + data) to be ready
 *
 * @returns {Promise<Object>} Object containing core and panel instances
 */
export async function initializeRecurringModules() {
    console.log('🔄 Initializing recurring task modules...');

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();
    console.log('✅ Core systems ready - initializing recurring modules');

    try {
        // ============================================
        // STEP 1: Import both modules (with version for cache-busting)
        // ============================================

        const version = window.APP_VERSION || '1.331';
        const recurringCore = await import(`./recurringCore.js?v=${version}`);
        const { RecurringPanelManager, buildRecurringSummaryFromSettings } = await import(`./recurringPanel.js?v=${version}`);

        console.log('✅ Recurring modules imported');

        // ============================================
        // STEP 2: Configure recurringCore dependencies (Strict DI)
        // ============================================

        console.log('🔧 Configuring recurringCore dependencies...');

        recurringCore.setRecurringCoreDependencies({
            // State management (required)
            getAppState: () => {
                if (!window.AppState) {
                    throw new Error('AppState not available');
                }
                return window.AppState.get();
            },
            updateAppState: (updateFn) => {
                if (!window.AppState) {
                    throw new Error('AppState not available');
                }
                return window.AppState.update(updateFn);
            },
            isAppStateReady: () => {
                return window.AppState && window.AppState.isReady();
            },

            // Data operations (legacy - for backwards compatibility)
            loadData: () => {
                if (typeof window.loadMiniCycleData !== 'function') {
                    console.warn('⚠️ loadMiniCycleData not available');
                    return null;
                }
                return window.loadMiniCycleData();
            },

            // Notifications (required)
            showNotification: (message, type, duration) => {
                if (typeof window.showNotification === 'function') {
                    return window.showNotification(message, type, duration);
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
                if (typeof window.refreshUIFromState === 'function') {
                    return window.refreshUIFromState();
                }
                console.warn('⚠️ refreshUIFromState not available');
            },
            updateProgressBar: () => {
                if (typeof window.updateProgressBar === 'function') {
                    return window.updateProgressBar();
                }
                console.warn('⚠️ updateProgressBar not available');
            },

            // Time/scheduling (required)
            now: () => Date.now(),
            setInterval: (fn, ms) => setInterval(fn, ms),

            // Feature flags (required)
            isEnabled: () => {
                return window.FeatureFlags?.recurringEnabled !== false;
            }
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

            // State management
            getAppState: () => window.AppState?.get(),
            isAppStateReady: () => window.AppState?.isReady(),
            loadData: () => window.loadMiniCycleData?.(),

            // UI dependencies
            showNotification: (message, type, duration) => {
                if (typeof window.showNotification === 'function') {
                    return window.showNotification(message, type, duration);
                }
                console.log(`[Panel Notification] ${message}`);
            },
            showConfirmationModal: (options) => {
                if (typeof window.notifications?.showConfirmationModal === 'function') {
                    return window.notifications.showConfirmationModal(options);
                }
                // Fallback to browser confirm
                const confirmed = confirm(options.message);
                if (options.callback) options.callback(confirmed);
            },
            getElementById: (id) => document.getElementById(id),
            querySelector: (selector) => document.querySelector(selector),
            querySelectorAll: (selector) => document.querySelectorAll(selector),

            // Advanced panel dependencies (optional)
            isOverlayActive: () => {
                if (typeof window.isOverlayActive === 'function') {
                    return window.isOverlayActive();
                }
                return false;
            }
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
        // STEP 7: Make functions globally accessible
        // ============================================

        console.log('🌐 Exposing recurring functions globally...');

        // Core functions
        window.recurringCore = {
            applyRecurringSettings: recurringCore.applyRecurringToTaskSchema25,
            handleActivation: recurringCore.handleRecurringTaskActivation,
            handleDeactivation: recurringCore.handleRecurringTaskDeactivation,
            deleteTemplate: recurringCore.deleteRecurringTemplate,
            removeTasksFromCycle: recurringCore.removeRecurringTasksFromCycle,
            handleAfterReset: recurringCore.handleRecurringTasksAfterReset,
            watchTasks: recurringCore.watchRecurringTasks,
            catchUpMissedTasks: recurringCore.catchUpMissedRecurringTasks,
            // Backward compatibility - redirect button visibility to panel
            updateRecurringButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility()
        };

        // Panel functions
        window.recurringPanel = {
            updatePanel: () => recurringPanel.updateRecurringPanel(),
            updateSummary: () => recurringPanel.updateRecurringSummary(),
            updateButtonVisibility: () => recurringPanel.updateRecurringPanelButtonVisibility(),
            openPanel: () => recurringPanel.openPanel(),
            closePanel: () => recurringPanel.closePanel(),
            openForTask: (taskId) => recurringPanel.openRecurringSettingsPanelForTask(taskId),
            saveAlwaysShowRecurringSetting: () => recurringPanel.saveAlwaysShowRecurringSetting(),
            loadAlwaysShowRecurringSetting: () => recurringPanel.loadAlwaysShowRecurringSetting()
        };

        // Backward compatibility - map old function names to new modules
        window.applyRecurringToTaskSchema25 = recurringCore.applyRecurringToTaskSchema25;
        window.handleRecurringTaskActivation = recurringCore.handleRecurringTaskActivation;
        window.handleRecurringTaskDeactivation = recurringCore.handleRecurringTaskDeactivation;
        window.deleteRecurringTemplate = recurringCore.deleteRecurringTemplate;
        window.removeRecurringTasksFromCycle = recurringCore.removeRecurringTasksFromCycle;
        window.handleRecurringTasksAfterReset = recurringCore.handleRecurringTasksAfterReset;
        window.watchRecurringTasks = recurringCore.watchRecurringTasks;
        window.catchUpMissedRecurringTasks = recurringCore.catchUpMissedRecurringTasks;
        window.setupRecurringWatcher = recurringCore.setupRecurringWatcher;

        window.updateRecurringPanel = () => recurringPanel.updateRecurringPanel();
        window.updateRecurringSummary = () => recurringPanel.updateRecurringSummary();
        window.updateRecurringPanelButtonVisibility = () => recurringPanel.updateRecurringPanelButtonVisibility();
        window.openRecurringSettingsPanelForTask = (taskId) => recurringPanel.openRecurringSettingsPanelForTask(taskId);
        window.buildRecurringSummaryFromSettings = buildRecurringSummaryFromSettings;

        console.log('✅ Recurring functions globally accessible');

        // ============================================
        // STEP 8: Process deferred setups
        // ============================================

        // If there were any deferred recurring setups, run them now
        if (window._deferredRecurringSetup && window._deferredRecurringSetup.length > 0) {
            console.log('📊 Processing', window._deferredRecurringSetup.length, 'deferred recurring setups');
            window._deferredRecurringSetup.forEach(setupFn => setupFn());
            window._deferredRecurringSetup = [];
        }

        console.log('✅ Recurring modules fully initialized and ready');

        return {
            core: recurringCore,
            panel: recurringPanel,
            manager: recurringPanel
        };

    } catch (error) {
        console.error('❌ Failed to initialize recurring modules:', error);

        // Show user-facing error
        if (typeof window.showNotification === 'function') {
            window.showNotification('Recurring feature initialization failed', 'error', 5000);
        }

        throw error;
    }
}

/**
 * Test function to verify recurring modules are working
 * Call this from browser console after initialization
 */
export function testRecurringIntegration() {
    console.log('🧪 Testing recurring integration...');

    const tests = {
        appStateReady: false,
        coreLoaded: false,
        panelLoaded: false,
        watcherActive: false,
        globalFunctionsAvailable: false
    };

    // Test 1: AppState ready
    try {
        tests.appStateReady = window.AppState && window.AppState.isReady();
        console.log(tests.appStateReady ? '✅' : '❌', 'AppState ready:', tests.appStateReady);
    } catch (e) {
        console.log('❌ AppState check failed:', e.message);
    }

    // Test 2: Core module loaded
    try {
        tests.coreLoaded = window.recurringCore && typeof window.recurringCore.applyRecurringSettings === 'function';
        console.log(tests.coreLoaded ? '✅' : '❌', 'Core module loaded:', tests.coreLoaded);
    } catch (e) {
        console.log('❌ Core module check failed:', e.message);
    }

    // Test 3: Panel loaded
    try {
        tests.panelLoaded = window.recurringPanel && typeof window.recurringPanel.updatePanel === 'function';
        console.log(tests.panelLoaded ? '✅' : '❌', 'Panel module loaded:', tests.panelLoaded);
    } catch (e) {
        console.log('❌ Panel module check failed:', e.message);
    }

    // Test 4: Watcher active
    try {
        tests.watcherActive = typeof window.watchRecurringTasks === 'function';
        console.log(tests.watcherActive ? '✅' : '❌', 'Watcher available:', tests.watcherActive);
    } catch (e) {
        console.log('❌ Watcher check failed:', e.message);
    }

    // Test 5: Global functions
    try {
        const requiredFunctions = [
            'applyRecurringToTaskSchema25',
            'handleRecurringTaskActivation',
            'handleRecurringTaskDeactivation',
            'updateRecurringPanel',
            'updateRecurringSummary',
            'openRecurringSettingsPanelForTask'
        ];

        tests.globalFunctionsAvailable = requiredFunctions.every(fn => typeof window[fn] === 'function');
        console.log(tests.globalFunctionsAvailable ? '✅' : '❌', 'Global functions available:', tests.globalFunctionsAvailable);
    } catch (e) {
        console.log('❌ Global functions check failed:', e.message);
    }

    // Summary
    const allPassed = Object.values(tests).every(t => t === true);
    console.log('\n' + '='.repeat(50));
    console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('='.repeat(50));

    return tests;
}

// Make test function globally available
if (typeof window !== 'undefined') {
    window.testRecurringIntegration = testRecurringIntegration;
}

console.log('🔗 Recurring integration module loaded');
