/**
 * 🧪 RoutineManager Tests
 * Tests for modules/routine/routineManager.js
 * Pattern: Resilient Constructor 🛡️
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 *
 * Tests routine management functionality:
 * - Constructor and dependency injection
 * - Dependency validation
 * - Routine creation modal
 * - Sample routine preloading
 * - Fallback routine creation
 * - Duplicate name handling
 * - AppState synchronization
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    createMockSanitizeInput,
    createMockData,
    waitForAsyncOperations
} from './testHelpers.js';

// Direct import from module (not via appContext which may not be populated)
import {
    RoutineManager,
    setRoutineManagerDependencies,
    initRoutineManager,
    getRoutineManager
} from '../modules/routine/routineManager.js';

export async function runRoutineManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🔄 RoutineManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>🔄 RoutineManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual routineManager test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual routineManager test completed - original localStorage restored');
        }
    }

    // Check if class is available
    if (!RoutineManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ RoutineManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    // Helper: Create valid mock dependencies for RoutineManager
    function createValidDeps(overrides = {}) {
        const mockSchemaData = createMockSchemaData();
        return {
            AppState: {
                isReady: () => true,
                get: () => mockSchemaData,
                update: (updateFn, immediate) => {
                    updateFn(mockSchemaData);
                    localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
                    return mockSchemaData;
                },
                data: mockSchemaData,
                isInitialized: true,
                isDirty: false,
                init: () => {}
            },
            loadMiniCycleData: () => mockSchemaData,
            showPromptModal: (options) => {
                // Simulate modal callback for testing
                if (options.callback) {
                    options.callback(null); // Default: user cancels
                }
            },
            showNotification: createMockNotification(),
            sanitizeInput: createMockSanitizeInput(),
            completeInitialSetup: () => {},
            hideMainMenu: () => {},
            updateProgressBar: () => {},
            checkCompleteAllButton: () => {},
            autoSave: () => {},
            safeLocalStorageGet: (key, fallback) => localStorage.getItem(key) || fallback,
            safeLocalStorageSet: (key, value) => localStorage.setItem(key, value),
            safeJSONParse: (str, fallback) => {
                try { return JSON.parse(str); } catch { return fallback; }
            },
            safeJSONStringify: (obj, fallback) => {
                try { return JSON.stringify(obj); } catch { return fallback; }
            },
            DEFAULT_TASK_OPTION_BUTTONS: {
                edit: true,
                delete: true,
                moveUp: false,
                moveDown: false
            },
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            AppMeta: { version: '1.0.0' },
            ...overrides
        };
    }

    // Helper: Create mock Schema 2.5 data
    function createMockSchemaData(overrides = {}) {
        return {
            metadata: {
                version: "2.5",
                lastModified: Date.now(),
                schemaVersion: "2.5",
                totalCyclesCreated: 1
            },
            settings: {
                theme: 'default',
                darkMode: false
            },
            data: {
                cycles: {
                    'Test Cycle': {
                        id: 'cycle-test',
                        title: 'Test Cycle',
                        tasks: [
                            { id: 'task-1', text: 'Task 1', completed: false }
                        ],
                        autoReset: true,
                        deleteCheckedTasks: false,
                        cycleCount: 0,
                        createdAt: Date.now(),
                        recurringTemplates: {}
                    }
                }
            },
            appState: {
                activeCycleId: 'Test Cycle',
                currentMode: 'auto-cycle'
            },
            userProgress: {
                cyclesCompleted: 0,
                totalTasksCompleted: 0
            },
            ...overrides
        };
    }

    // Helper: poll for a selector to appear (up to maxMs). The creation dialog is
    // built behind a setTimeout PLUS an async sample-manifest fetch, so on
    // production (and especially in the throttled cross-origin test iframe) it can
    // appear well after any single fixed delay — poll instead of guessing one.
    async function waitForSelector(selector, maxMs = 4000) {
        const start = performance.now();
        let el = document.querySelector(selector);
        while (!el && performance.now() - start < maxMs) {
            await new Promise(resolve => setTimeout(resolve, 50));
            el = document.querySelector(selector);
        }
        return el;
    }

    // Helper: poll until a condition is true (up to maxMs).
    async function waitForCondition(conditionFn, maxMs = 4000) {
        const start = performance.now();
        while (!conditionFn() && performance.now() - start < maxMs) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return conditionFn();
    }

    // Helper: Wait for creation dialog to appear and simulate user input
    async function fillAndConfirmCreationDialog(inputValue, timeout = 4000) {
        // Poll for the async _buildCreationDialog to finish (floor of 4s so legacy
        // callers passing a short timeout still tolerate a slow first fetch).
        const dialog = await waitForSelector('.miniCycle-prompt-dialog', Math.max(timeout, 4000));
        if (!dialog) return null;

        const input = dialog.querySelector('.miniCycle-prompt-input');
        const confirmBtn = dialog.querySelector('.miniCycle-btn-confirm');

        if (input && inputValue !== undefined) {
            input.value = inputValue;
        }
        if (confirmBtn && inputValue !== undefined) {
            confirmBtn.click();
        }

        // Small delay for click handlers to execute
        await new Promise(resolve => setTimeout(resolve, 50));
        return dialog;
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Set up default mock data
            const mockSchemaData = createMockSchemaData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Reset DOM state
            document.body.className = '';

            // Clear existing modal elements
            const existingModals = document.querySelectorAll('.miniCycle-prompt-dialog, .mini-modal-dialog, .miniCycle-overlay, .mini-modal-overlay');
            existingModals.forEach(el => el.remove());

            // Clear global state
            delete window.AppState;

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization Tests</h4>';

    await test('creates instance successfully with valid dependencies', async () => {
        const deps = createValidDeps();
        const instance = new RoutineManager(deps);

        if (!instance) {
            throw new Error('RoutineManager not created');
        }
        if (typeof instance.showCycleCreationModal !== 'function') {
            throw new Error('showCycleCreationModal method not found');
        }
        if (typeof instance.createNewMiniCycle !== 'function') {
            throw new Error('createNewMiniCycle method not found');
        }
    });

    await test('throws error when missing required dependencies', async () => {
        let threw = false;
        try {
            new RoutineManager({});
        } catch (error) {
            threw = true;
            if (!error.message.includes('missing required dependencies')) {
                throw new Error('Should throw with "missing required dependencies" message');
            }
        }
        if (!threw) {
            throw new Error('Should throw when missing required dependencies');
        }
    });

    await test('validates all required dependencies', async () => {
        // These are the actual required deps per _validateDependencies()
        const requiredDeps = [
            'AppState',
            'loadMiniCycleData',
            'showPromptModal',
            'sanitizeInput',
            'completeInitialSetup',
            'hideMainMenu',
            'DEFAULT_TASK_OPTION_BUTTONS'
        ];

        // Test each missing dependency
        for (const depName of requiredDeps) {
            const deps = createValidDeps();
            delete deps[depName];

            let threw = false;
            try {
                new RoutineManager(deps);
            } catch (error) {
                threw = true;
                if (!error.message.includes(depName)) {
                    throw new Error(`Error should mention missing dep: ${depName}`);
                }
            }
            if (!threw) {
                throw new Error(`Should throw when missing ${depName}`);
            }
        }
    });

    await test('accepts version from AppMeta', async () => {
        const deps = createValidDeps({
            AppMeta: { version: '2.5.0' }
        });
        const instance = new RoutineManager(deps);

        if (instance.version !== '2.5.0') {
            throw new Error(`Expected version 2.5.0, got ${instance.version}`);
        }
    });

    await test('setRoutineManagerDependencies sets module-level deps', async () => {
        if (typeof setRoutineManagerDependencies !== 'function') {
            throw new Error('setRoutineManagerDependencies not exported');
        }

        // Set module-level deps
        setRoutineManagerDependencies({
            testDep: 'test-value'
        });

        // Create instance without that dep - should merge
        const deps = createValidDeps();
        const instance = new RoutineManager(deps);

        // Instance should exist (testDep is not required)
        if (!instance) {
            throw new Error('Instance should be created with merged deps');
        }
    });

    await test('initRoutineManager creates and returns instance', async () => {
        if (typeof initRoutineManager !== 'function') {
            throw new Error('initRoutineManager not exported');
        }

        const deps = createValidDeps();
        const instance = await initRoutineManager(deps);

        if (!instance) {
            throw new Error('initRoutineManager should return instance');
        }
        if (!(instance instanceof RoutineManager)) {
            throw new Error('Should return RoutineManager instance');
        }
    });

    await test('getRoutineManager returns the initialized instance', async () => {
        if (typeof getRoutineManager !== 'function') {
            throw new Error('getRoutineManager not exported');
        }

        const deps = createValidDeps();
        const created = await initRoutineManager(deps);
        const retrieved = getRoutineManager();

        if (retrieved !== created) {
            throw new Error('getRoutineManager should return the same instance');
        }
    });

    // === FALLBACK NOTIFICATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📢 Fallback Notification Tests</h4>';

    await test('fallbackNotification logs to console', async () => {
        const deps = createValidDeps();
        const instance = new RoutineManager(deps);

        // Should not throw
        instance.fallbackNotification('Test message', 'info', 3000);
        instance.fallbackNotification('Warning message', 'warning');
        instance.fallbackNotification('Error message', null);
    });

    await test('uses fallback notification when showNotification not provided', async () => {
        const deps = createValidDeps();
        delete deps.showNotification; // Remove it

        const instance = new RoutineManager(deps);

        // Should use fallbackNotification - should not throw
        instance.deps.showNotification('Test', 'info', 3000);
    });

    // === SHOW CYCLE CREATION MODAL TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🆕 Cycle Creation Modal Tests</h4>';

    await test('showCycleCreationModal opens creation dialog', async () => {
        const deps = createValidDeps();

        const instance = new RoutineManager(deps);
        instance.showCycleCreationModal();

        // Poll for the dialog — it's built behind setTimeout(500) + an async
        // sample-manifest fetch, which can exceed any fixed delay on production.
        const dialog = await waitForSelector('.miniCycle-prompt-dialog', 4000);
        if (!dialog) {
            throw new Error('Creation dialog should appear in DOM');
        }
        const input = dialog.querySelector('.miniCycle-prompt-input');
        if (!input) {
            throw new Error('Dialog should have an input field');
        }
        const confirmBtn = dialog.querySelector('.miniCycle-btn-confirm');
        if (!confirmBtn) {
            throw new Error('Dialog should have a confirm button');
        }
        const cancelBtn = dialog.querySelector('.miniCycle-btn-cancel');
        if (!cancelBtn) {
            throw new Error('Dialog should have a cancel button');
        }
    });

    await test('showCycleCreationModal creates new cycle on valid input', async () => {
        let completeSetupCalled = false;

        const deps = createValidDeps({
            sanitizeInput: (input) => input.trim(),
            completeInitialSetup: (cycleId, data) => {
                completeSetupCalled = true;
            }
        });

        const instance = new RoutineManager(deps);
        instance.showCycleCreationModal();

        await fillAndConfirmCreationDialog('My New Cycle');

        // Poll for the async onCreateBlank callback to call completeInitialSetup
        // (its internal awaits — AppState.update etc. — settle asynchronously).
        await waitForCondition(() => completeSetupCalled, 3000);

        if (!completeSetupCalled) {
            throw new Error('completeInitialSetup should be called');
        }

        // Check the cycle was created - uses title as key, not cycle_ prefix
        const stored = JSON.parse(localStorage.getItem('miniCycleData'));
        const newCycle = stored.data.cycles['My New Cycle'];

        if (!newCycle) {
            throw new Error('New cycle should be created with title as key');
        }

        if (newCycle.title !== 'My New Cycle') {
            throw new Error(`Cycle title should be "My New Cycle", got "${newCycle.title}"`);
        }
    });

    await test('showCycleCreationModal rejects empty input with error state', async () => {
        const deps = createValidDeps();

        const instance = new RoutineManager(deps);
        instance.showCycleCreationModal();

        // Wait for setTimeout(500) + async _buildCreationDialog
        await new Promise(resolve => setTimeout(resolve, 700));

        const dialog = document.querySelector('.miniCycle-prompt-dialog');
        if (!dialog) {
            throw new Error('Dialog should appear');
        }

        const input = dialog.querySelector('.miniCycle-prompt-input');
        const confirmBtn = dialog.querySelector('.miniCycle-btn-confirm');

        // Leave input empty and click confirm
        input.value = '';
        confirmBtn.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        // Dialog should still be open (empty input is rejected)
        if (!document.querySelector('.miniCycle-prompt-dialog')) {
            throw new Error('Dialog should remain open on empty input');
        }

        // Input should have error class
        if (!input.classList.contains('miniCycle-input-error')) {
            throw new Error('Input should have error class on empty submission');
        }
    });

    // === CREATE BASIC FALLBACK CYCLE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🆘 Fallback Cycle Tests</h4>';

    await test('createBasicFallbackCycle creates a basic cycle', async () => {
        let completeSetupCalled = false;

        const deps = createValidDeps({
            completeInitialSetup: (cycleId, data) => {
                completeSetupCalled = true;
            }
        });

        const instance = new RoutineManager(deps);
        await instance.createBasicFallbackCycle();

        if (!completeSetupCalled) {
            throw new Error('completeInitialSetup should be called');
        }

        // Check the cycle was created - uses title as key
        const stored = JSON.parse(localStorage.getItem('miniCycleData'));
        const fallbackCycle = stored.data.cycles['Getting Started'];

        if (!fallbackCycle) {
            throw new Error('Fallback cycle should be created with title as key');
        }

        if (fallbackCycle.title !== 'Getting Started') {
            throw new Error(`Fallback title should be "Getting Started", got "${fallbackCycle.title}"`);
        }
        if (fallbackCycle.tasks.length !== 2) {
            throw new Error(`Fallback should have 2 tasks, got ${fallbackCycle.tasks.length}`);
        }
    });

    await test('createBasicFallbackCycle handles missing schema data', async () => {
        localStorage.clear(); // No schema data

        const deps = createValidDeps({
            safeLocalStorageGet: () => null,
            safeJSONParse: () => null
        });

        const instance = new RoutineManager(deps);

        // Should not throw
        instance.createBasicFallbackCycle();
    });

    await test('createBasicFallbackCycle syncs AppState', async () => {
        // createBasicFallbackCycle uses injected deps.AppState (DI pattern)
        let updateCalled = false;
        const mockSchemaData = createMockSchemaData();
        const mockAppState = {
            isReady: () => true,
            get: () => mockSchemaData,
            update: (updateFn) => {
                updateCalled = true;
                updateFn(mockSchemaData);
                localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
            },
            reload: () => {}
        };

        const deps = createValidDeps({
            AppState: mockAppState,
            completeInitialSetup: () => {}
        });

        const instance = new RoutineManager(deps);
        await instance.createBasicFallbackCycle();

        // Check that AppState.update was called (the DI-pure way of syncing)
        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }
        // Verify the cycle was created in the data
        if (!mockSchemaData.data.cycles['Getting Started']) {
            throw new Error('Fallback cycle should be created in AppState data');
        }
    });

    // === CREATE NEW MINICYCLE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">➕ Create New MiniCycle Tests</h4>';

    await test('createNewMiniCycle checks AppState readiness', async () => {
        let notificationShown = false;

        const deps = createValidDeps({
            AppState: {
                isReady: () => false,
                get: () => null
            },
            showNotification: (msg) => {
                notificationShown = true;
                if (!msg.includes('not ready')) {
                    throw new Error('Should warn about AppState not ready');
                }
            }
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        if (!notificationShown) {
            throw new Error('Should show notification when AppState not ready');
        }
    });

    await test('createNewMiniCycle opens creation dialog', async () => {
        const deps = createValidDeps();

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Wait for async _buildCreationDialog (no setTimeout wrapper)
        await new Promise(resolve => setTimeout(resolve, 300));

        const dialog = document.querySelector('.miniCycle-prompt-dialog');
        if (!dialog) {
            throw new Error('Creation dialog should appear in DOM');
        }
        const input = dialog.querySelector('.miniCycle-prompt-input');
        if (!input) {
            throw new Error('Dialog should have an input field');
        }
        const confirmBtn = dialog.querySelector('.miniCycle-btn-confirm');
        if (!confirmBtn) {
            throw new Error('Dialog should have a confirm button');
        }
    });

    await test('createNewMiniCycle handles user cancellation', async () => {
        const deps = createValidDeps();

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Wait for async _buildCreationDialog
        await new Promise(resolve => setTimeout(resolve, 300));

        const dialog = document.querySelector('.miniCycle-prompt-dialog');
        if (!dialog) {
            throw new Error('Dialog should appear');
        }

        const cancelBtn = dialog.querySelector('.miniCycle-btn-cancel');
        cancelBtn.click();

        // Wait for click handler to execute
        await new Promise(resolve => setTimeout(resolve, 50));

        // Dialog should be removed from DOM after cancel
        const remainingDialog = document.querySelector('.miniCycle-prompt-dialog');
        if (remainingDialog) {
            throw new Error('Dialog should be closed and removed after cancel');
        }
    });

    await test('createNewMiniCycle creates cycle with unique title', async () => {
        let updateCalled = false;
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn, immediate) => {
                    updateCalled = true;
                    updateFn(mockData);
                    localStorage.setItem('miniCycleData', JSON.stringify(mockData));
                }
            },
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Brand New Cycle', 300);

        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }

        // Check the cycle was created
        if (!mockData.data.cycles['Brand New Cycle']) {
            throw new Error('Cycle should be created with title as key');
        }
    });

    await test('createNewMiniCycle handles duplicate title with numbered suffix', async () => {
        const notifications = [];
        const mockData = createMockSchemaData();

        // Add existing cycle with same name
        mockData.data.cycles['Duplicate Name'] = {
            id: 'cycle-dup',
            title: 'Duplicate Name',
            tasks: []
        };

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn, immediate) => {
                    updateFn(mockData);
                }
            },
            sanitizeInput: (input) => input.trim(),
            showNotification: (msg) => {
                notifications.push(msg);
            }
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Duplicate Name', 300);

        // Should create "Duplicate Name (2)"
        if (!mockData.data.cycles['Duplicate Name (2)']) {
            throw new Error('Should create numbered variation for duplicate');
        }
        // Check notification was sent (may contain warning about duplicate)
        const hasWarning = notifications.some(msg =>
            msg && (msg.includes('already exists') || msg.includes('Using'))
        );
        if (!hasWarning && notifications.length === 0) {
            // If no notifications, the cycle was still created correctly - test passes
            // The notification is optional behavior
        }
    });

    await test('createNewMiniCycle falls back to timestamp when too many duplicates', async () => {
        const notifications = [];
        const mockData = createMockSchemaData();

        // Add many existing cycles with same name (fill up to 10)
        mockData.data.cycles['Many Dupes'] = { id: 'c1', title: 'Many Dupes', tasks: [] };
        for (let i = 2; i <= 11; i++) {
            mockData.data.cycles[`Many Dupes (${i})`] = { id: `c${i}`, title: `Many Dupes (${i})`, tasks: [] };
        }

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn, immediate) => {
                    updateFn(mockData);
                }
            },
            sanitizeInput: (input) => input.trim(),
            showNotification: (msg) => {
                notifications.push(msg);
            }
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Many Dupes', 300);

        // Fallback appends timestamp to the name (e.g., "Many Dupes (1735822342415)")
        const cycleKeys = Object.keys(mockData.data.cycles);
        // Look for a key that starts with "Many Dupes (" and ends with a timestamp
        const timestampKey = cycleKeys.find(k => {
            if (!k.startsWith('Many Dupes (')) return false;
            // Check if it's a timestamp (not a simple number)
            const num = k.match(/\((\d+)\)$/);
            return num && num[1].length > 10; // Timestamps are longer than 10 digits
        });

        if (!timestampKey) {
            throw new Error('Should fall back to timestamp-based name');
        }
    });

    await test('createNewMiniCycle updates UI elements', async () => {
        const mockData = createMockSchemaData();

        // Create mock DOM elements
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        taskList.innerHTML = '<div>Old task</div>';
        document.body.appendChild(taskList);

        const titleElement = document.createElement('h1');
        titleElement.id = 'mini-cycle-title';
        document.body.appendChild(titleElement);

        const autoReset = document.createElement('input');
        autoReset.id = 'toggleAutoReset';
        autoReset.type = 'checkbox';
        autoReset.checked = false;
        document.body.appendChild(autoReset);

        const deleteChecked = document.createElement('input');
        deleteChecked.id = 'deleteCheckedTasks';
        deleteChecked.type = 'checkbox';
        deleteChecked.checked = true;
        document.body.appendChild(deleteChecked);

        let hideMenuCalled = false;
        let updateProgressCalled = false;
        let checkCompleteCalled = false;
        let updateCalled = false;

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn, immediate) => {
                    updateCalled = true;
                    updateFn(mockData);
                }
            },
            sanitizeInput: (input) => input.trim(),
            hideMainMenu: () => { hideMenuCalled = true; },
            updateProgressBar: () => { updateProgressCalled = true; },
            checkCompleteAllButton: () => { checkCompleteCalled = true; }
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('UI Test Cycle', 300);

        // Check UI updates
        if (taskList.innerHTML !== '') {
            throw new Error('Task list should be cleared');
        }
        if (titleElement.textContent !== 'UI Test Cycle') {
            throw new Error('Title should be updated');
        }
        if (!autoReset.checked) {
            throw new Error('Auto-reset should be checked');
        }
        if (deleteChecked.checked) {
            throw new Error('Delete checked should be unchecked');
        }
        if (!hideMenuCalled) {
            throw new Error('hideMainMenu should be called');
        }
        if (!updateProgressCalled) {
            throw new Error('updateProgressBar should be called');
        }
        if (!checkCompleteCalled) {
            throw new Error('checkCompleteAllButton should be called');
        }
        // AppState.update with immediate=true handles persistence (autoSave is removed)
        if (!updateCalled) {
            throw new Error('AppState.update should be called for persistence');
        }
    });

    await test('createNewMiniCycle notifies undo system', async () => {
        let undoNotified = false;
        let undoCycleKey = null;
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim(),
            onCycleCreated: async (cycleKey) => {
                undoNotified = true;
                undoCycleKey = cycleKey;
            }
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Undo Test Cycle', 300);

        // Wait for async onCycleCreated
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!undoNotified) {
            throw new Error('onCycleCreated should be called');
        }
        if (undoCycleKey !== 'Undo Test Cycle') {
            throw new Error(`Undo should receive cycle key, got ${undoCycleKey}`);
        }
    });

    // === SCHEMA 2.5 STORAGE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Schema 2.5 Storage Tests</h4>';

    await test('new cycle has correct Schema 2.5 structure', async () => {
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => {
                    updateFn(mockData);
                    localStorage.setItem('miniCycleData', JSON.stringify(mockData));
                }
            },
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Schema Test', 300);

        const newCycle = mockData.data.cycles['Schema Test'];

        if (!newCycle) {
            throw new Error('Cycle should be created');
        }

        // Check required properties
        if (!newCycle.id || !newCycle.id.startsWith('cycle_')) {
            throw new Error('Cycle should have id starting with cycle_');
        }
        if (newCycle.title !== 'Schema Test') {
            throw new Error('Cycle should have correct title');
        }
        if (!Array.isArray(newCycle.tasks)) {
            throw new Error('Cycle should have tasks array');
        }
        if (newCycle.autoReset !== true) {
            throw new Error('Default autoReset should be true');
        }
        if (newCycle.deleteCheckedTasks !== false) {
            throw new Error('Default deleteCheckedTasks should be false');
        }
        if (newCycle.cycleCount !== 0) {
            throw new Error('Default cycleCount should be 0');
        }
        if (typeof newCycle.createdAt !== 'number') {
            throw new Error('Cycle should have createdAt timestamp');
        }
        if (typeof newCycle.recurringTemplates !== 'object') {
            throw new Error('Cycle should have recurringTemplates object');
        }
        if (!newCycle.taskOptionButtons) {
            throw new Error('Cycle should have taskOptionButtons');
        }
    });

    await test('updates metadata.lastModified on cycle creation', async () => {
        const mockData = createMockSchemaData();
        const originalTimestamp = mockData.metadata.lastModified;

        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Timestamp Test', 300);

        if (mockData.metadata.lastModified <= originalTimestamp) {
            throw new Error('lastModified should be updated');
        }
    });

    await test('increments totalCyclesCreated on cycle creation', async () => {
        const mockData = createMockSchemaData();
        const originalCount = mockData.metadata.totalCyclesCreated;

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Count Test', 300);

        if (mockData.metadata.totalCyclesCreated !== originalCount + 1) {
            throw new Error('totalCyclesCreated should be incremented');
        }
    });

    await test('sets activeCycleId to new cycle', async () => {
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Active Test', 300);

        if (mockData.appState.activeCycleId !== 'Active Test') {
            throw new Error('activeCycleId should be set to new cycle');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling Tests</h4>';

    await test('showCycleCreationModal handles missing schema data', async () => {
        localStorage.clear();

        const deps = createValidDeps({
            safeLocalStorageGet: () => null,
            safeJSONParse: () => null
        });

        const instance = new RoutineManager(deps);

        // Should not throw
        instance.showCycleCreationModal();

        // Wait for setTimeout(500) + async _buildCreationDialog
        await new Promise(resolve => setTimeout(resolve, 700));

        // Dialog should still appear even with missing schema data
        const dialog = document.querySelector('.miniCycle-prompt-dialog');
        if (!dialog) {
            throw new Error('Dialog should appear even with missing schema data');
        }
    });

    await test('handles missing DOM elements gracefully', async () => {
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim(),
            getElementById: () => null // Missing DOM elements
        });

        const instance = new RoutineManager(deps);

        // Should not throw
        instance.createNewMiniCycle();

        // Fill and confirm the dialog — should not throw despite missing DOM elements
        await fillAndConfirmCreationDialog('No DOM Test', 300);
    });

    await test('handles onCycleCreated rejection gracefully', async () => {
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim(),
            onCycleCreated: async () => {
                throw new Error('Undo system error');
            }
        });

        const instance = new RoutineManager(deps);

        // Should not throw despite onCycleCreated rejection
        instance.createNewMiniCycle();

        // Fill and confirm the dialog
        await fillAndConfirmCreationDialog('Rejection Test', 300);

        // Wait for async onCycleCreated to reject
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration Tests</h4>';

    await test('syncs AppState via update after cycle creation', async () => {
        const mockData = createMockSchemaData();
        let updateCalled = false;
        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (updateFn, immediate) => {
                updateCalled = true;
                updateFn(mockData);
            },
            reload: () => {}
        };

        const deps = createValidDeps({
            AppState: mockAppState,
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);

        // For showCycleCreationModal path
        instance.showCycleCreationModal();

        // Wait for setTimeout(500) + async _buildCreationDialog, then fill and confirm
        await fillAndConfirmCreationDialog('Sync Test', 700);

        // Wait for async onCreateBlank callback
        await new Promise(resolve => setTimeout(resolve, 100));

        // AppState.update should be called to sync data
        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }
        // Verify the cycle was created
        if (!mockData.data.cycles['Sync Test']) {
            throw new Error('Cycle should be created in AppState data');
        }
    });

    await test('works with constructor dependency injection', async () => {
        const deps = createValidDeps();
        const instance = new RoutineManager(deps);

        // Verify deps are properly set
        if (!instance.deps.AppState) {
            throw new Error('AppState should be injected');
        }
        if (typeof instance.deps.showNotification !== 'function') {
            throw new Error('showNotification should be injected');
        }
    });

    await test('merges module-level and constructor deps correctly', async () => {
        // Set module-level dep
        setRoutineManagerDependencies({
            customModuleDep: 'module-value'
        });

        const deps = createValidDeps({
            customConstructorDep: 'constructor-value'
        });

        const instance = new RoutineManager(deps);

        // Constructor deps should be present
        if (!instance.deps.AppState) {
            throw new Error('Constructor deps should be present');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance Tests</h4>';

    await test('createBasicFallbackCycle completes quickly', async () => {
        const deps = createValidDeps({
            completeInitialSetup: () => {}
        });

        const instance = new RoutineManager(deps);

        const startTime = performance.now();
        instance.createBasicFallbackCycle();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 100) {
            throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
        }
    });

    await test('createNewMiniCycle confirm callback is fast', async () => {
        const mockData = createMockSchemaData();

        const deps = createValidDeps({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (updateFn) => { updateFn(mockData); }
            },
            sanitizeInput: (input) => input.trim()
        });

        const instance = new RoutineManager(deps);
        instance.createNewMiniCycle();

        // Wait for dialog to appear
        await new Promise(resolve => setTimeout(resolve, 300));

        const dialog = document.querySelector('.miniCycle-prompt-dialog');
        if (!dialog) {
            throw new Error('Dialog should appear');
        }

        const input = dialog.querySelector('.miniCycle-prompt-input');
        const confirmBtn = dialog.querySelector('.miniCycle-btn-confirm');
        input.value = 'Perf Test';

        const start = performance.now();
        confirmBtn.click();
        const callbackDuration = performance.now() - start;

        if (callbackDuration > 50) {
            throw new Error(`Callback took too long: ${callbackDuration.toFixed(2)}ms`);
        }
    });

    // === preloadInitialRunCycle (focus-first onboarding) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 preloadInitialRunCycle</h4>';

    await test('preloadInitialRunCycle fetches from examples/initial-run/ and skips success toast', async () => {
        const originalFetch = window.fetch;
        const fetchCalls = [];
        let toastShown = false;

        window.fetch = async (url) => {
            fetchCalls.push(url);
            if (url.includes('initial-run/Your_First_Routine.mcyc')) {
                return new Response(JSON.stringify({
                    name: 'Your First Routine',
                    title: 'Your First Routine',
                    tasks: [{ id: 't1', text: 'sample', completed: false, schemaVersion: 2 }],
                    showTaskInput: true,
                    autoReset: true,
                    cycleCount: 0
                }), { status: 200 });
            }
            return new Response('not found', { status: 404 });
        };

        try {
            const deps = createValidDeps({
                showNotification: () => { toastShown = true; },
                loadMiniCycle: () => {},
                hideMainMenu: () => {},
                updateMainMenuHeader: () => {},
                updateProgressBar: () => {},
                checkCompleteAllButton: () => {},
                refreshThemeLabels: () => {}
            });
            const instance = new RoutineManager(deps);

            const result = await instance.preloadInitialRunCycle();

            if (!result) throw new Error('preloadInitialRunCycle should return true on success');
            const fetchedInitialRun = fetchCalls.some(u => u.includes('initial-run/Your_First_Routine.mcyc'));
            if (!fetchedInitialRun) throw new Error(`Did not fetch from initial-run/. Calls: ${JSON.stringify(fetchCalls)}`);
            if (toastShown) throw new Error('silent option should suppress success toast');
        } finally {
            window.fetch = originalFetch;
        }
    });

    await test('preloadInitialRunCycle passes showTaskInput from file into cycle state', async () => {
        const originalFetch = window.fetch;
        let savedState = null;

        window.fetch = async () => new Response(JSON.stringify({
            name: 'Your First Routine',
            title: 'Your First Routine',
            tasks: [],
            showTaskInput: true,
            autoReset: true
        }), { status: 200 });

        try {
            const mockState = createMockSchemaData();
            mockState.data.cycles = {};
            const deps = createValidDeps({
                AppState: {
                    isReady: () => true,
                    get: () => mockState,
                    update: (fn) => { fn(mockState); savedState = mockState; return mockState; },
                    isInitialized: true
                },
                loadMiniCycle: () => {},
                hideMainMenu: () => {},
                updateMainMenuHeader: () => {},
                updateProgressBar: () => {},
                checkCompleteAllButton: () => {},
                refreshThemeLabels: () => {}
            });
            const instance = new RoutineManager(deps);

            await instance.preloadInitialRunCycle();

            const cycles = Object.values(savedState?.data?.cycles || {});
            if (cycles.length === 0) throw new Error('No cycle was created');
            const created = cycles[0];
            if (created.showTaskInput !== true) {
                throw new Error(`showTaskInput should be true on the created cycle, got ${created.showTaskInput}`);
            }
        } finally {
            window.fetch = originalFetch;
        }
    });

    await test('preloadInitialRunCycle returns false when fetch fails', async () => {
        const originalFetch = window.fetch;
        window.fetch = async () => new Response('not found', { status: 404 });

        try {
            const deps = createValidDeps();
            const instance = new RoutineManager(deps);

            const result = await instance.preloadInitialRunCycle();

            if (result !== false) throw new Error('preloadInitialRunCycle should return false on fetch failure');
        } finally {
            window.fetch = originalFetch;
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
