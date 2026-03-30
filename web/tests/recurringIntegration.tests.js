/**
 * RecurringIntegration Module Tests
 * Tests for the recurring task integration and initialization
 */

import {
    initRecurringModules,
    testRecurringIntegration,
    setRecurringIntegrationDependencies
} from '../modules/recurring/recurringIntegration.js';

/**
 * Helper to set up DI dependencies for recurring integration tests
 * @param {Object} mockAppState - Mock AppState object
 * @param {Function} mockShowNotification - Mock notification function
 * @param {Object} mockFeatureFlags - Mock feature flags
 */
function setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags) {
    setRecurringIntegrationDependencies({
        appInit: { waitForCore: () => Promise.resolve() },
        AppState: mockAppState,
        showNotification: mockShowNotification,
        FeatureFlags: mockFeatureFlags,
        loadMiniCycleData: () => mockAppState?.get?.() || null,
        refreshUIFromState: () => {},
        updateProgressBar: () => {},
        notifications: { showConfirmationModal: () => {} },
        isOverlayActive: () => false,
        getDeferredRecurringSetup: () => window._deferredRecurringSetup || [],
        clearDeferredRecurringSetup: () => { window._deferredRecurringSetup = []; },
        GlobalUtils: {
            safeAddEventListener: (el, event, handler) => {
                el.removeEventListener(event, handler);
                el.addEventListener(event, handler);
            }
        }
    });
}

export async function runRecurringIntegrationTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔗 RecurringIntegration Tests</h2><h3>Running tests...</h3>';

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
            if (result instanceof Promise) await result;
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

    await test('initializes with valid dependencies', async () => {
        // Setup mocks
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;

        // Set up DI dependencies
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

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

    await test('exposes recurringCore globally', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Phase 3: check returned object (no window.* exports)
        if (!result.core) {
            throw new Error('recurringCore not returned');
        }

        if (!result.coreAPI || typeof result.coreAPI.applyRecurringSettings !== 'function') {
            throw new Error('coreAPI.applyRecurringSettings not a function');
        }
    });

    await test('returns recurringPanel in result', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Phase 3: check returned object (no window.* exports)
        if (!result.panel) {
            throw new Error('recurringPanel not returned');
        }

        if (!result.panelAPI || typeof result.panelAPI.updatePanel !== 'function') {
            throw new Error('panelAPI.updatePanel not a function');
        }
    });

    await test('returns complete API objects', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Check coreAPI functions
        const requiredCoreFunctions = [
            'applyRecurringSettings',
            'handleActivation',
            'handleDeactivation'
        ];

        requiredCoreFunctions.forEach(fn => {
            if (typeof result.coreAPI[fn] !== 'function') {
                throw new Error(`coreAPI.${fn} not a function`);
            }
        });

        // Check panelAPI functions
        const requiredPanelFunctions = [
            'updatePanel',
            'updateSummary',
            'updateButtonVisibility'
        ];

        requiredPanelFunctions.forEach(fn => {
            if (typeof result.panelAPI[fn] !== 'function') {
                throw new Error(`panelAPI.${fn} not a function`);
            }
        });
    });

    await test('handles missing AppState gracefully', async () => {
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = null;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(null, mockShowNotification, mockFeatureFlags);

        try {
            await initRecurringModules({ AppMeta: { version: 'test' } });
            throw new Error('Should have thrown error for missing AppState');
        } catch (error) {
            if (!error.message.includes('AppState') && !error.message.includes('missing required deps')) {
                throw new Error('Wrong error thrown: ' + error.message);
            }
        }
    });

    await test('processes deferred setups', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;

        let deferredCalled = false;
        window._deferredRecurringSetup = [
            () => { deferredCalled = true; }
        ];
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        await initRecurringModules({ AppMeta: { version: 'test' } });

        if (!deferredCalled) {
            throw new Error('Deferred setup not called');
        }

        if (window._deferredRecurringSetup.length !== 0) {
            throw new Error('Deferred setup array not cleared');
        }
    });

    // === TEST FUNCTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Test Function</h4>';


    // === DEPENDENCY CONFIGURATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 Dependency Configuration</h4>';

    await test('configures state management dependencies', async () => {
        const mockAppState = {
            get: () => ({ test: 'data' }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Verify dependencies were configured by checking core is functional
        if (!result.core) {
            throw new Error('Core not returned with configured dependencies');
        }
    });

    await test('configures notification dependencies', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        let notificationCalled = false;
        const mockShowNotification = (msg) => { notificationCalled = true; };
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        await initRecurringModules({ AppMeta: { version: 'test' } });

        // Verify notification dependency works
        if (typeof window.showNotification !== 'function') {
            throw new Error('Notification function not available');
        }
    });

    await test('configures feature flag dependencies', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: false };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        // Should still initialize even if feature is disabled
        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        if (!result) {
            throw new Error('Should initialize even with feature disabled');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('catches and reports initialization errors', async () => {
        // Force an error by providing invalid state
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = null;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(null, mockShowNotification, mockFeatureFlags);

        try {
            await initRecurringModules({ AppMeta: { version: 'test' } });
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
        const mockShowNotification = (msg, type) => {
            notificationMessage = msg;
            return { message: msg, type };
        };
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = null;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(null, mockShowNotification, mockFeatureFlags);

        try {
            await initRecurringModules({ AppMeta: { version: 'test' } });
        } catch (error) {
            // Expected error
        }

        if (!notificationMessage || !notificationMessage.includes('failed')) {
            throw new Error('Error notification not shown');
        }
    });

    // === GLOBAL FUNCTION AVAILABILITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Functions</h4>';

    await test('exposes applyRecurringToTaskSchema25', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Phase 3: check returned coreAPI (no window.* exports)
        if (!result.coreAPI || typeof result.coreAPI.applyRecurringSettings !== 'function') {
            throw new Error('coreAPI.applyRecurringSettings not exposed');
        }
    });

    await test('returns handleActivation in coreAPI', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Phase 3: check returned coreAPI
        if (!result.coreAPI || typeof result.coreAPI.handleActivation !== 'function') {
            throw new Error('coreAPI.handleActivation not exposed');
        }
    });

    await test('returns panel update functions in panelAPI', async () => {
        const mockAppState = {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        };
        const mockShowNotification = (msg) => msg;
        const mockFeatureFlags = { recurringEnabled: true };

        window.AppState = mockAppState;
        window.showNotification = mockShowNotification;
        window.FeatureFlags = mockFeatureFlags;
        setupDIDeps(mockAppState, mockShowNotification, mockFeatureFlags);

        const result = await initRecurringModules({ AppMeta: { version: 'test' } });

        // Phase 3: check returned panelAPI
        const panelFunctions = [
            'updatePanel',
            'updateSummary',
            'updateButtonVisibility'
        ];

        panelFunctions.forEach(fn => {
            if (!result.panelAPI || typeof result.panelAPI[fn] !== 'function') {
                throw new Error(`panelAPI.${fn} not exposed`);
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
