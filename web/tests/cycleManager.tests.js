/**
 * @file cycleManager.tests.js
 * @description Tests for the CycleManager module
 * @version 1.357
 *
 * Tests cover:
 * - Constructor initialization with dependency injection
 * - Cycle creation modal workflow
 * - Sample cycle loading (success/failure paths)
 * - Fallback cycle creation
 * - New cycle creation from main menu
 * - Duplicate name handling
 * - AppState synchronization
 * - Storage operations
 * - Error handling
 */

export async function runCycleManagerTests(resultsDiv, isPartOfSuite = false) {
    let total = { count: 0 };
    let passed = { count: 0 };

    // Save original localStorage and globals
    const originalLocalStorage = { ...localStorage };
    const originalAppState = window.AppState;
    const originalGlobals = {};

    // Track modified keys for cleanup
    const modifiedKeys = new Set();

    // Helper to track localStorage changes
    function trackSet(key, value) {
        modifiedKeys.add(key);
        localStorage.setItem(key, value);
    }

    // Helper to clean up after each test
    function cleanupTest() {
        // Restore localStorage
        modifiedKeys.forEach(key => localStorage.removeItem(key));
        modifiedKeys.clear();

        // Restore globals
        Object.keys(originalGlobals).forEach(key => {
            window[key] = originalGlobals[key];
        });
    }

    async function test(name, testFn) {
        total.count++;
        try {
            await testFn();
            passed.count++;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            cleanupTest();
        }
    }

    // ============================================
    // CONSTRUCTOR AND INITIALIZATION TESTS
    // ============================================

    await test('CycleManager class exists', async () => {
        if (typeof window.CycleManager !== 'function') {
            throw new Error('CycleManager class should be available on window');
        }
    });

    await test('CycleManager can be instantiated without dependencies', async () => {
        const manager = new window.CycleManager();
        if (!manager) {
            throw new Error('CycleManager should instantiate without dependencies');
        }
        if (manager.version !== '1.357') {
            throw new Error('CycleManager should have correct version');
        }
    });

    await test('CycleManager accepts dependency injection', async () => {
        const mockDeps = {
            AppState: { test: true },
            showNotification: (msg) => msg,
            sanitizeInput: (input) => input
        };
        const manager = new window.CycleManager(mockDeps);
        if (manager.deps.AppState !== mockDeps.AppState) {
            throw new Error('CycleManager should use injected dependencies');
        }
    });

    await test('CycleManager has fallbackNotification method', async () => {
        const manager = new window.CycleManager();
        if (typeof manager.fallbackNotification !== 'function') {
            throw new Error('fallbackNotification should be a function');
        }
        // Should not throw
        manager.fallbackNotification('test', 'info', 3000);
    });

    await test('CycleManager has all required methods', async () => {
        const manager = new window.CycleManager();
        const methods = [
            'showCycleCreationModal',
            'preloadGettingStartedCycle',
            'createBasicFallbackCycle',
            'createNewMiniCycle',
            'fallbackNotification'
        ];
        methods.forEach(method => {
            if (typeof manager[method] !== 'function') {
                throw new Error(`CycleManager should have ${method} method`);
            }
        });
    });

    // ============================================
    // FALLBACK NOTIFICATION TESTS
    // ============================================

    await test('fallbackNotification logs message', async () => {
        const manager = new window.CycleManager();
        const originalLog = console.log;
        let logged = false;
        console.log = (msg) => {
            if (msg.includes('TEST MESSAGE')) logged = true;
        };

        manager.fallbackNotification('TEST MESSAGE', 'info', 3000);
        console.log = originalLog;

        if (!logged) {
            throw new Error('fallbackNotification should log message');
        }
    });

    // ============================================
    // BASIC FALLBACK CYCLE TESTS
    // ============================================

    await test('createBasicFallbackCycle creates cycle with correct structure', async () => {
        // Setup minimal schema data
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };
        trackSet('miniCycleData', JSON.stringify(schemaData));

        const mockAppState = {
            data: schemaData,
            isInitialized: false,
            isDirty: true,
            init: function() {}
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showNotification: () => {},
            completeInitialSetup: () => {}
        });

        manager.createBasicFallbackCycle();

        const updated = JSON.parse(localStorage.getItem('miniCycleData'));
        const cycles = Object.values(updated.data.cycles);

        if (cycles.length !== 1) {
            throw new Error('Should create exactly one cycle');
        }

        const cycle = cycles[0];
        if (cycle.title !== 'Getting Started') {
            throw new Error('Fallback cycle should have title "Getting Started"');
        }
        if (!Array.isArray(cycle.tasks) || cycle.tasks.length < 2) {
            throw new Error('Fallback cycle should have welcome tasks');
        }
    });

    await test('createBasicFallbackCycle synchronizes AppState', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };
        trackSet('miniCycleData', JSON.stringify(schemaData));

        const mockAppState = {
            data: null,
            isInitialized: false,
            isDirty: true,
            init: function() {}
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showNotification: () => {},
            completeInitialSetup: () => {}
        });

        manager.createBasicFallbackCycle();

        if (!mockAppState.data) {
            throw new Error('Should sync AppState.data');
        }
        if (!mockAppState.isInitialized) {
            throw new Error('Should mark AppState as initialized');
        }
        if (mockAppState.isDirty !== false) {
            throw new Error('Should mark AppState as clean after save');
        }
    });

    await test('createBasicFallbackCycle increments totalCyclesCreated', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 5 }
        };
        trackSet('miniCycleData', JSON.stringify(schemaData));

        const manager = new window.CycleManager({
            AppState: { init: () => {} },
            showNotification: () => {},
            completeInitialSetup: () => {}
        });

        manager.createBasicFallbackCycle();

        const updated = JSON.parse(localStorage.getItem('miniCycleData'));
        if (updated.metadata.totalCyclesCreated !== 6) {
            throw new Error('Should increment totalCyclesCreated from 5 to 6');
        }
    });

    // ============================================
    // NEW CYCLE CREATION TESTS
    // ============================================

    await test('createNewMiniCycle checks AppState readiness', async () => {
        const mockAppState = {
            isReady: () => false
        };

        let notificationShown = false;
        const manager = new window.CycleManager({
            AppState: mockAppState,
            showNotification: (msg) => { notificationShown = msg.includes('not ready'); }
        });

        manager.createNewMiniCycle();

        if (!notificationShown) {
            throw new Error('Should show "not ready" notification when AppState not ready');
        }
    });

    await test('createNewMiniCycle shows prompt modal when AppState ready', async () => {
        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {}
        };

        let modalShown = false;
        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                modalShown = opts.title === 'Create New miniCycle';
            },
            showNotification: () => {}
        });

        manager.createNewMiniCycle();

        if (!modalShown) {
            throw new Error('Should show prompt modal when AppState ready');
        }
    });

    await test('createNewMiniCycle handles empty input (cancellation)', async () => {
        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {}
        };

        let cancelNotificationShown = false;
        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                // Simulate user canceling (empty input)
                opts.callback('');
            },
            showNotification: (msg) => {
                if (msg.includes('canceled')) cancelNotificationShown = true;
            },
            sanitizeInput: (input) => input
        });

        manager.createNewMiniCycle();

        if (!cancelNotificationShown) {
            throw new Error('Should show cancellation notification for empty input');
        }
    });

    await test('createNewMiniCycle creates cycle with unique name', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };

        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('My Test Cycle');
            },
            showNotification: () => {},
            sanitizeInput: (input) => input,
            getElementById: () => ({ innerHTML: '', textContent: '', checked: false }),
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {}
        });

        manager.createNewMiniCycle();

        const cycles = Object.values(schemaData.data.cycles);
        if (cycles.length !== 1) {
            throw new Error('Should create exactly one cycle');
        }

        const cycle = cycles[0];
        if (cycle.title !== 'My Test Cycle') {
            throw new Error(`Expected title "My Test Cycle", got "${cycle.title}"`);
        }
    });

    await test('createNewMiniCycle handles duplicate names with numbered suffix', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: {
                cycles: {
                    'Daily Routine': {
                        id: 'cycle_1',
                        title: 'Daily Routine',
                        tasks: []
                    }
                }
            },
            appState: { activeCycleId: 'Daily Routine' },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 1 }
        };

        let warningShown = false;
        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('Daily Routine'); // Same name as existing
            },
            showNotification: (msg) => {
                if (msg.includes('already exists')) warningShown = true;
            },
            sanitizeInput: (input) => input,
            getElementById: () => ({ innerHTML: '', textContent: '', checked: false }),
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {}
        });

        manager.createNewMiniCycle();

        if (!warningShown) {
            throw new Error('Should show warning for duplicate name');
        }

        if (!schemaData.data.cycles['Daily Routine (2)']) {
            throw new Error('Should create cycle with numbered suffix "Daily Routine (2)"');
        }
    });

    await test('createNewMiniCycle sets cycle as active', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };

        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('Active Cycle');
            },
            showNotification: () => {},
            sanitizeInput: (input) => input,
            getElementById: () => ({ innerHTML: '', textContent: '', checked: false }),
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {}
        });

        manager.createNewMiniCycle();

        if (schemaData.appState.activeCycleId !== 'Active Cycle') {
            throw new Error('Should set new cycle as active');
        }
    });

    await test('createNewMiniCycle updates UI elements', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };

        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const uiCalls = {
            hideMainMenu: false,
            updateProgressBar: false,
            checkCompleteAllButton: false,
            autoSave: false,
            titleUpdated: false
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('UI Test');
            },
            showNotification: () => {},
            sanitizeInput: (input) => input,
            getElementById: (id) => {
                if (id === 'mini-cycle-title') {
                    return {
                        set textContent(val) { uiCalls.titleUpdated = true; }
                    };
                }
                return { innerHTML: '', checked: false };
            },
            hideMainMenu: () => { uiCalls.hideMainMenu = true; },
            updateProgressBar: () => { uiCalls.updateProgressBar = true; },
            checkCompleteAllButton: () => { uiCalls.checkCompleteAllButton = true; },
            autoSave: () => { uiCalls.autoSave = true; }
        });

        manager.createNewMiniCycle();

        if (!uiCalls.hideMainMenu) throw new Error('Should call hideMainMenu');
        if (!uiCalls.updateProgressBar) throw new Error('Should call updateProgressBar');
        if (!uiCalls.checkCompleteAllButton) throw new Error('Should call checkCompleteAllButton');
        if (!uiCalls.autoSave) throw new Error('Should call autoSave');
        if (!uiCalls.titleUpdated) throw new Error('Should update title element');
    });

    // ============================================
    // GLOBAL FUNCTION WRAPPER TESTS
    // ============================================

    await test('initializeCycleManager creates global instance', async () => {
        const mockDeps = {
            AppState: { test: true }
        };

        // Import and call initialization
        const module = await import('../modules/cycle/cycleManager.js?v=' + Date.now());
        const manager = module.initializeCycleManager(mockDeps);

        if (!manager) {
            throw new Error('Should return CycleManager instance');
        }
        if (!(manager instanceof window.CycleManager)) {
            throw new Error('Should return instance of CycleManager class');
        }
    });

    await test('global showCycleCreationModal wrapper exists', async () => {
        if (typeof window.showCycleCreationModal !== 'function') {
            throw new Error('window.showCycleCreationModal should exist');
        }
    });

    await test('global preloadGettingStartedCycle wrapper exists', async () => {
        if (typeof window.preloadGettingStartedCycle !== 'function') {
            throw new Error('window.preloadGettingStartedCycle should exist');
        }
    });

    await test('global createBasicFallbackCycle wrapper exists', async () => {
        if (typeof window.createBasicFallbackCycle !== 'function') {
            throw new Error('window.createBasicFallbackCycle should exist');
        }
    });

    await test('global createNewMiniCycle wrapper exists', async () => {
        if (typeof window.createNewMiniCycle !== 'function') {
            throw new Error('window.createNewMiniCycle should exist');
        }
    });

    // ============================================
    // STORAGE AND DATA INTEGRITY TESTS
    // ============================================

    await test('created cycles have required Schema 2.5 fields', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };

        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('Schema Test');
            },
            showNotification: () => {},
            sanitizeInput: (input) => input,
            getElementById: () => ({ innerHTML: '', textContent: '', checked: false }),
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {}
        });

        manager.createNewMiniCycle();

        const cycle = schemaData.data.cycles['Schema Test'];
        const required = ['id', 'title', 'tasks', 'autoReset', 'deleteCheckedTasks',
                         'cycleCount', 'createdAt', 'recurringTemplates'];

        required.forEach(field => {
            if (!(field in cycle)) {
                throw new Error(`Cycle should have required field: ${field}`);
            }
        });
    });

    await test('created cycles have correct default values', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: Date.now(), totalCyclesCreated: 0 }
        };

        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('Defaults Test');
            },
            showNotification: () => {},
            sanitizeInput: (input) => input,
            getElementById: () => ({ innerHTML: '', textContent: '', checked: false }),
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {}
        });

        manager.createNewMiniCycle();

        const cycle = schemaData.data.cycles['Defaults Test'];

        if (cycle.autoReset !== true) {
            throw new Error('autoReset should default to true');
        }
        if (cycle.deleteCheckedTasks !== false) {
            throw new Error('deleteCheckedTasks should default to false');
        }
        if (cycle.cycleCount !== 0) {
            throw new Error('cycleCount should default to 0');
        }
        if (!Array.isArray(cycle.tasks) || cycle.tasks.length !== 0) {
            throw new Error('tasks should default to empty array');
        }
    });

    await test('metadata.lastModified is updated on cycle creation', async () => {
        const schemaData = {
            schemaVersion: 2.5,
            data: { cycles: {} },
            appState: { activeCycleId: null },
            metadata: { lastModified: 1000, totalCyclesCreated: 0 }
        };

        const mockAppState = {
            isReady: () => true,
            update: (fn, immediate) => {
                fn(schemaData);
            }
        };

        const manager = new window.CycleManager({
            AppState: mockAppState,
            showPromptModal: (opts) => {
                opts.callback('Timestamp Test');
            },
            showNotification: () => {},
            sanitizeInput: (input) => input,
            getElementById: () => ({ innerHTML: '', textContent: '', checked: false }),
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {}
        });

        manager.createNewMiniCycle();

        if (schemaData.metadata.lastModified <= 1000) {
            throw new Error('lastModified should be updated to current timestamp');
        }
    });

    // Summary
    const percentage = total.count > 0 ? Math.round((passed.count / total.count) * 100) : 0;

    if (!isPartOfSuite) {
        resultsDiv.innerHTML = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>` + resultsDiv.innerHTML;
    }

    return { passed: passed.count, total: total.count };
}
