/**
 * RecurringIntegration Module Tests
 * Tests for the recurring task integration and initialization
 */

import {
    initializeRecurringModules,
    testRecurringIntegration
} from '../utilities/recurringIntegration.js';

export function runRecurringIntegrationTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔗 RecurringIntegration Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        // Save global state
        const savedGlobals = {
            AppState: window.AppState,
            showNotification: window.showNotification,
            loadMiniCycleData: window.loadMiniCycleData,
            refreshUIFromState: window.refreshUIFromState,
            FeatureFlags: window.FeatureFlags,
            recurringCore: window.recurringCore,
            recurringPanel: window.recurringPanel,
            notifications: window.notifications
        };

        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // Restore global state
            Object.keys(savedGlobals).forEach(key => {
                if (savedGlobals[key] === undefined) {
                    delete window[key];
                } else {
                    window[key] = savedGlobals[key];
                }
            });

            // Clean up other global functions
            const globalFunctions = [
                'applyRecurringToTaskSchema25',
                'handleRecurringTaskActivation',
                'handleRecurringTaskDeactivation',
                'deleteRecurringTemplate',
                'removeRecurringTasksFromCycle',
                'handleRecurringTasksAfterReset',
                'watchRecurringTasks',
                'setupRecurringWatcher',
                'updateRecurringPanel',
                'updateRecurringSummary',
                'updateRecurringPanelButtonVisibility',
                'openRecurringSettingsPanelForTask',
                'buildRecurringSummaryFromSettings'
            ];

            globalFunctions.forEach(fn => {
                if (fn in savedGlobals) {
                    window[fn] = savedGlobals[fn];
                } else {
                    delete window[fn];
                }
            });

            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // === MOCK SETUP TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Mock Setup</h4>';

    test('creates mock AppState for testing', () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.AppState = mockAppState;

        if (!window.AppState || !window.AppState.isReady()) {
            throw new Error('Mock AppState not set up correctly');
        }
    });

    test('creates mock notification system', () => {
        window.showNotification = (msg, type, duration) => {
            return { message: msg, type, duration };
        };

        if (typeof window.showNotification !== 'function') {
            throw new Error('Mock notification not set up');
        }
    });

    test('creates mock FeatureFlags', () => {
        window.FeatureFlags = { recurringEnabled: true };

        if (!window.FeatureFlags || window.FeatureFlags.recurringEnabled !== true) {
            throw new Error('Mock FeatureFlags not set up correctly');
        }
    });

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Initialization</h4>';

    test('initializes with valid dependencies', async () => {
        // Setup mocks
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        const result = await initializeRecurringModules();

        if (!result) {
            throw new Error('Initialization did not return result');
        }

        if (!result.core) {
            throw new Error('Core module not returned');
        }

        if (!result.panel) {
            throw new Error('Panel module not returned');
        }
    });

    test('exposes recurringCore globally', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        if (!window.recurringCore) {
            throw new Error('recurringCore not exposed globally');
        }

        if (typeof window.recurringCore.applyRecurringSettings !== 'function') {
            throw new Error('recurringCore.applyRecurringSettings not a function');
        }
    });

    test('exposes recurringPanel globally', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        if (!window.recurringPanel) {
            throw new Error('recurringPanel not exposed globally');
        }

        if (typeof window.recurringPanel.updatePanel !== 'function') {
            throw new Error('recurringPanel.updatePanel not a function');
        }
    });

    test('exposes backward compatible functions', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        const requiredFunctions = [
            'applyRecurringToTaskSchema25',
            'handleRecurringTaskActivation',
            'handleRecurringTaskDeactivation',
            'updateRecurringPanel'
        ];

        requiredFunctions.forEach(fn => {
            if (typeof window[fn] !== 'function') {
                throw new Error(`${fn} not exposed globally`);
            }
        });
    });

    test('handles missing AppState gracefully', async () => {
        window.AppState = null;
        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        try {
            await initializeRecurringModules();
            throw new Error('Should have thrown error for missing AppState');
        } catch (error) {
            if (!error.message.includes('AppState')) {
                throw new Error('Wrong error thrown');
            }
        }
    });

    test('processes deferred setups', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        let deferredCalled = false;
        window._deferredRecurringSetup = [
            () => { deferredCalled = true; }
        ];

        await initializeRecurringModules();

        if (!deferredCalled) {
            throw new Error('Deferred setup not called');
        }

        if (window._deferredRecurringSetup.length !== 0) {
            throw new Error('Deferred setup array not cleared');
        }
    });

    // === TEST FUNCTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Test Function</h4>';

    test('testRecurringIntegration exists', () => {
        if (typeof testRecurringIntegration !== 'function') {
            throw new Error('testRecurringIntegration not a function');
        }
    });

    test('testRecurringIntegration checks AppState', () => {
        window.AppState = {
            isReady: () => true
        };

        const result = testRecurringIntegration();

        if (!result) {
            throw new Error('Test function did not return results');
        }

        if (typeof result.appStateReady !== 'boolean') {
            throw new Error('appStateReady not checked');
        }
    });

    test('testRecurringIntegration checks core module', () => {
        window.recurringCore = {
            applyRecurringSettings: () => {}
        };

        const result = testRecurringIntegration();

        if (typeof result.coreLoaded !== 'boolean') {
            throw new Error('coreLoaded not checked');
        }
    });

    test('testRecurringIntegration checks panel module', () => {
        window.recurringPanel = {
            updatePanel: () => {}
        };

        const result = testRecurringIntegration();

        if (typeof result.panelLoaded !== 'boolean') {
            throw new Error('panelLoaded not checked');
        }
    });

    test('testRecurringIntegration checks watcher', () => {
        window.watchRecurringTasks = () => {};

        const result = testRecurringIntegration();

        if (typeof result.watcherActive !== 'boolean') {
            throw new Error('watcherActive not checked');
        }
    });

    test('testRecurringIntegration checks global functions', () => {
        window.applyRecurringToTaskSchema25 = () => {};
        window.handleRecurringTaskActivation = () => {};
        window.handleRecurringTaskDeactivation = () => {};
        window.updateRecurringPanel = () => {};
        window.updateRecurringSummary = () => {};
        window.openRecurringSettingsPanelForTask = () => {};

        const result = testRecurringIntegration();

        if (typeof result.globalFunctionsAvailable !== 'boolean') {
            throw new Error('globalFunctionsAvailable not checked');
        }
    });

    test('testRecurringIntegration returns all tests passing', () => {
        // Setup complete environment
        window.AppState = { isReady: () => true };
        window.recurringCore = { applyRecurringSettings: () => {} };
        window.recurringPanel = { updatePanel: () => {} };
        window.watchRecurringTasks = () => {};
        window.applyRecurringToTaskSchema25 = () => {};
        window.handleRecurringTaskActivation = () => {};
        window.handleRecurringTaskDeactivation = () => {};
        window.updateRecurringPanel = () => {};
        window.updateRecurringSummary = () => {};
        window.openRecurringSettingsPanelForTask = () => {};

        const result = testRecurringIntegration();

        const allPassed = Object.values(result).every(t => t === true);

        if (!allPassed) {
            throw new Error('Not all tests passed in complete environment');
        }
    });

    test('testRecurringIntegration handles errors gracefully', () => {
        // Clear all globals to trigger errors
        delete window.AppState;
        delete window.recurringCore;
        delete window.recurringPanel;
        delete window.watchRecurringTasks;

        // Should not throw error
        const result = testRecurringIntegration();

        if (!result) {
            throw new Error('Test function should return results even with errors');
        }
    });

    // === DEPENDENCY CONFIGURATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Dependency Configuration</h4>';

    test('configures state management dependencies', async () => {
        window.AppState = {
            get: () => ({ test: 'data' }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        const result = await initializeRecurringModules();

        // Verify dependencies were configured by checking core is functional
        if (!result.core) {
            throw new Error('Core not returned with configured dependencies');
        }
    });

    test('configures notification dependencies', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        let notificationCalled = false;
        window.showNotification = (msg) => { notificationCalled = true; };
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        // Verify notification dependency works
        if (typeof window.showNotification !== 'function') {
            throw new Error('Notification function not available');
        }
    });

    test('configures feature flag dependencies', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: false };

        // Should still initialize even if feature is disabled
        const result = await initializeRecurringModules();

        if (!result) {
            throw new Error('Should initialize even with feature disabled');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('catches and reports initialization errors', async () => {
        // Force an error by providing invalid state
        window.AppState = null;
        window.showNotification = (msg) => msg;

        try {
            await initializeRecurringModules();
            throw new Error('Should have thrown initialization error');
        } catch (error) {
            // Expected - error should be caught and rethrown
            if (!error.message) {
                throw new Error('Error should have message');
            }
        }
    });

    test('shows notification on initialization failure', async () => {
        window.AppState = null;

        let notificationMessage = null;
        window.showNotification = (msg, type) => {
            notificationMessage = msg;
            return { message: msg, type };
        };

        try {
            await initializeRecurringModules();
        } catch (error) {
            // Expected error
        }

        if (!notificationMessage || !notificationMessage.includes('failed')) {
            throw new Error('Error notification not shown');
        }
    });

    // === GLOBAL FUNCTION AVAILABILITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Functions</h4>';

    test('exposes applyRecurringToTaskSchema25', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        if (typeof window.applyRecurringToTaskSchema25 !== 'function') {
            throw new Error('applyRecurringToTaskSchema25 not exposed');
        }
    });

    test('exposes handleRecurringTaskActivation', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        if (typeof window.handleRecurringTaskActivation !== 'function') {
            throw new Error('handleRecurringTaskActivation not exposed');
        }
    });

    test('exposes panel update functions', async () => {
        window.AppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };

        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        await initializeRecurringModules();

        const panelFunctions = [
            'updateRecurringPanel',
            'updateRecurringSummary',
            'updateRecurringPanelButtonVisibility'
        ];

        panelFunctions.forEach(fn => {
            if (typeof window[fn] !== 'function') {
                throw new Error(`${fn} not exposed`);
            }
        });
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
