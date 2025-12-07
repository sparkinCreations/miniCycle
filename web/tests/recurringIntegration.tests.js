/**
 * RecurringIntegration Module Tests
 * Tests for the recurring task integration and initialization
 */

import {
    initializeRecurringModules,
    testRecurringIntegration,
    setRecurringIntegrationDependencies
} from '../modules/recurring/recurringIntegration.js';

import {
    setupTestEnvironment,
    createMockAppState
} from './testHelpers.js';

export async function runRecurringIntegrationTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔗 RecurringIntegration Tests</h2><h3>Running tests...</h3>';

    // Setup test environment
    await setupTestEnvironment();

    let passed = { count: 0 };
    let total = { count: 0 };

    async function test(name, testFn) {
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
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }
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

    // Helper to inject DI dependencies for tests that use initializeRecurringModules
    // IMPORTANT: mockSchemaData should be saved to localStorage BEFORE calling this
    function injectDependencies(mockSchemaData) {
        // Save mock data to localStorage first
        localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

        // Create mock AppState with default storage key (reads from localStorage)
        const mockAppState = createMockAppState();

        setRecurringIntegrationDependencies({
            AppState: mockAppState,
            showNotification: (msg) => msg,
            loadMiniCycleData: () => mockAppState.get(),
            refreshUIFromState: () => {},
            updateProgressBar: () => {},
            FeatureFlags: { recurringEnabled: true }
        });
        // Also set window.AppState for backward compat tests
        window.AppState = mockAppState;
        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

        return mockAppState;
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

    await test('initializes with valid dependencies', async () => {
        // DI-pure: inject dependencies via setRecurringIntegrationDependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

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

    await test('returns recurringCore from initialization', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        if (!result.core) {
            throw new Error('recurringCore not returned from initialization');
        }

        if (typeof result.core.applyRecurringToTaskSchema25 !== 'function') {
            throw new Error('recurringCore.applyRecurringToTaskSchema25 not a function');
        }
    });

    await test('returns recurringPanel from initialization', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        if (!result.panel) {
            throw new Error('recurringPanel not returned from initialization');
        }

        if (typeof result.panel.updatePanel !== 'function') {
            throw new Error('recurringPanel.updatePanel not a function');
        }
    });

    await test('returns core functions from initialization', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        // Check that core module has required functions
        const requiredFunctions = [
            'applyRecurringToTaskSchema25',
            'handleRecurringTaskActivation',
            'handleRecurringTaskDeactivation'
        ];

        requiredFunctions.forEach(fn => {
            if (typeof result.core[fn] !== 'function') {
                throw new Error(`${fn} not available on core module`);
            }
        });
    });

    await test('handles missing AppState gracefully', async () => {
        // DI-pure: inject null AppState
        setRecurringIntegrationDependencies({
            AppState: null,
            showNotification: (msg) => msg,
            FeatureFlags: { recurringEnabled: true }
        });
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

    await test('processes deferred setups', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        const mockAppState = createMockAppState(mockSchemaData);

        let deferredCalled = false;
        window._deferredRecurringSetup = [
            () => { deferredCalled = true; }
        ];

        setRecurringIntegrationDependencies({
            AppState: mockAppState,
            showNotification: (msg) => msg,
            loadMiniCycleData: () => mockAppState.get(),
            FeatureFlags: { recurringEnabled: true },
            getDeferredRecurringSetup: () => window._deferredRecurringSetup,
            clearDeferredRecurringSetup: () => { window._deferredRecurringSetup = []; }
        });
        window.AppState = mockAppState;
        window.showNotification = (msg) => msg;
        window.FeatureFlags = { recurringEnabled: true };

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

    await test('testRecurringIntegration checks AppState via DI', async () => {
        // DI-pure: inject AppState via dependencies
        injectDependencies({ schemaVersion: "2.5" });

        const result = testRecurringIntegration();

        if (!result) {
            throw new Error('Test function did not return results');
        }

        if (typeof result.appStateReady !== 'boolean') {
            throw new Error('appStateReady not checked');
        }
    });

    await test('testRecurringIntegration checks core module', async () => {
        // DI-pure: pass recurringModules parameter with mock core
        const mockRecurringModules = {
            core: {
                applyRecurringToTaskSchema25: () => {}
            }
        };

        const result = testRecurringIntegration(mockRecurringModules);

        if (typeof result.coreLoaded !== 'boolean') {
            throw new Error('coreLoaded not checked');
        }
    });

    await test('testRecurringIntegration checks panel module', async () => {
        // DI-pure: pass recurringModules parameter with mock panel
        const mockRecurringModules = {
            panel: {
                updateRecurringPanel: () => {}
            }
        };

        const result = testRecurringIntegration(mockRecurringModules);

        if (typeof result.panelLoaded !== 'boolean') {
            throw new Error('panelLoaded not checked');
        }
    });

    await test('testRecurringIntegration checks coreAPI completeness', async () => {
        // DI-pure: pass recurringModules with complete coreAPI
        const mockRecurringModules = {
            coreAPI: {
                applyRecurringSettings: () => {},
                handleActivation: () => {},
                handleDeactivation: () => {},
                deleteTemplate: () => {},
                removeTasksFromCycle: () => {}
            }
        };

        const result = testRecurringIntegration(mockRecurringModules);

        if (typeof result.coreAPIComplete !== 'boolean') {
            throw new Error('coreAPIComplete not checked');
        }
    });

    await test('testRecurringIntegration checks panelAPI completeness', async () => {
        // DI-pure: pass recurringModules with complete panelAPI
        const mockRecurringModules = {
            panelAPI: {
                updatePanel: () => {},
                updateSummary: () => {},
                updateButtonVisibility: () => {},
                openPanel: () => {},
                closePanel: () => {},
                openForTask: () => {}
            }
        };

        const result = testRecurringIntegration(mockRecurringModules);

        if (typeof result.panelAPIComplete !== 'boolean') {
            throw new Error('panelAPIComplete not checked');
        }
    });

    await test('testRecurringIntegration returns all tests passing', async () => {
        // DI-pure: inject AppState and pass complete recurringModules
        injectDependencies({ schemaVersion: "2.5" });

        const mockRecurringModules = {
            core: {
                applyRecurringToTaskSchema25: () => {}
            },
            panel: {
                updateRecurringPanel: () => {}
            },
            coreAPI: {
                applyRecurringSettings: () => {},
                handleActivation: () => {},
                handleDeactivation: () => {},
                deleteTemplate: () => {},
                removeTasksFromCycle: () => {}
            },
            panelAPI: {
                updatePanel: () => {},
                updateSummary: () => {},
                updateButtonVisibility: () => {},
                openPanel: () => {},
                closePanel: () => {},
                openForTask: () => {}
            }
        };

        const result = testRecurringIntegration(mockRecurringModules);

        const allPassed = Object.values(result).every(t => t === true);

        if (!allPassed) {
            throw new Error('Not all tests passed in complete environment');
        }
    });

    await test('testRecurringIntegration handles null recurringModules gracefully', async () => {
        // Should not throw error when no recurringModules passed
        const result = testRecurringIntegration(null);

        if (!result) {
            throw new Error('Test function should return results even with null input');
        }
    });

    // === DEPENDENCY CONFIGURATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Dependency Configuration</h4>';

    await test('configures state management dependencies', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = { test: 'data' };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        // Verify dependencies were configured by checking core is functional
        if (!result.core) {
            throw new Error('Core not returned with configured dependencies');
        }
    });

    await test('configures notification dependencies', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        // Verify notification dependency works
        if (typeof window.showNotification !== 'function') {
            throw new Error('Notification function not available');
        }
    });

    await test('configures feature flag dependencies', async () => {
        // DI-pure: inject dependencies with feature disabled
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        const mockAppState = createMockAppState(mockSchemaData);
        setRecurringIntegrationDependencies({
            AppState: mockAppState,
            showNotification: (msg) => msg,
            loadMiniCycleData: () => mockAppState.get(),
            FeatureFlags: { recurringEnabled: false }
        });
        window.AppState = mockAppState;
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

    await test('catches and reports initialization errors', async () => {
        // DI-pure: inject null AppState to force error
        setRecurringIntegrationDependencies({
            AppState: null,
            showNotification: (msg) => msg
        });
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

    await test('shows notification on initialization failure', async () => {
        let notificationMessage = null;
        const mockNotification = (msg, type) => {
            notificationMessage = msg;
            return { message: msg, type };
        };

        // DI-pure: inject null AppState to force error
        setRecurringIntegrationDependencies({
            AppState: null,
            showNotification: mockNotification
        });
        window.AppState = null;
        window.showNotification = mockNotification;

        try {
            await initializeRecurringModules();
        } catch (error) {
            // Expected error
        }

        if (!notificationMessage || !notificationMessage.includes('failed')) {
            throw new Error('Error notification not shown');
        }
    });

    // === MODULE FUNCTION AVAILABILITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Module Functions</h4>';

    await test('core has applyRecurringToTaskSchema25', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        if (typeof result.core.applyRecurringToTaskSchema25 !== 'function') {
            throw new Error('applyRecurringToTaskSchema25 not available on core');
        }
    });

    await test('core has handleRecurringTaskActivation', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        if (typeof result.core.handleRecurringTaskActivation !== 'function') {
            throw new Error('handleRecurringTaskActivation not available on core');
        }
    });

    await test('panel has update functions', async () => {
        // DI-pure: inject dependencies
        const mockSchemaData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        injectDependencies(mockSchemaData);

        const result = await initializeRecurringModules();

        if (typeof result.panel.updatePanel !== 'function') {
            throw new Error('updatePanel not available on panel');
        }
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
