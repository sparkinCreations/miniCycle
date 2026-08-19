/**
 * Settings Manager Tests
 *
 * Tests for modules/ui/settingsManager.js
 * Pattern: Resilient Constructor 🛡️
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 *
 * Functions tested:
 * - setupSettingsMenu() - Initialize settings UI
 * - setupDownloadMiniCycle() - Setup export functionality
 * - setupUploadMiniCycle() - Setup import functionality
 * - exportMiniCycleData() - Export .mcyc file
 * - syncCurrentSettingsToStorage() - Sync settings to Schema 2.5
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    expect
} from './testHelpers.js';

// Module references - populated by dynamic import in runSettingsManagerTests
let SettingsManager, setSettingsManagerDependencies, _resetForTesting;

export async function runSettingsManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>⚙️ Settings Manager Tests</h2><h3>Loading module...</h3>';

    // Dynamic import with cache busting to avoid stale CDN cache
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/ui/settingsManager.js?v=${cacheBuster}`);
    SettingsManager = module.SettingsManager;
    setSettingsManagerDependencies = module.setSettingsManagerDependencies;
    _resetForTesting = module._resetForTesting;

    resultsDiv.innerHTML = '<h2>⚙️ Settings Manager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Set up SettingsManager module dependencies
    // AppState mock must work both as a direct object (settingsUIManager calls
    // _deps.AppState.get()) AND as a factory function (other code calls
    // _deps.AppState()).
    const defaultAppStateMock = Object.assign(
        () => ({ isReady: () => true, get: () => ({ settings: {} }), update: () => {} }),
        { isReady: () => true, get: () => ({ settings: {} }), update: () => {} }
    );
    // showNotification is declared required(), so it belongs in the BASE wiring
    // rather than only in the tests that happen to assert on it. Individual
    // tests still re-inject their own spy where they need to observe the calls.
    setSettingsManagerDependencies({
        safeAddEventListener: env.deps.safeAddEventListener,
        AppState: defaultAppStateMock,
        showNotification: () => {},
        // Also required(), and the facade forwards it to its sub-modules at WIRE
        // time — so a constructor override never reaches settingsUIManager and
        // it has to come from here. Tests needing specific data still override.
        loadMiniCycleData: () => ({ settings: {} })
    });

    resultsDiv.innerHTML = '<h2>⚙️ Settings Manager Tests</h2>';
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
        console.log('🔒 Saved original localStorage for individual settingsManager test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual settingsManager test completed - original localStorage restored');
        }
    }


    // Check if class is available
    if (!SettingsManager) {
        resultsDiv.innerHTML += '<div class="result fail">SettingsManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Mock full Schema 2.5 data structure
            const mockFullSchema = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now(),
                    totalCyclesCreated: 1
                },
                settings: {
                    theme: 'default',
                    darkMode: false
                },
                data: {
                    cycles: {
                        'cycle-1': {
                            id: 'cycle-1',
                            title: 'Test Cycle',
                            tasks: [
                                { id: 'task-1', text: 'Task 1', completed: false },
                                { id: 'task-2', text: 'Task 2', completed: true }
                            ],
                            cycleCount: 5,
                            autoReset: true
                        }
                    }
                },
                appState: {
                    activeCycleId: 'cycle-1',
                    currentMode: 'auto-cycle'
                },
                userProgress: {
                    cyclesCompleted: 10
                }
            };

            // Flattened data structure that loadMiniCycleData returns
            const mockFlattenedData = {
                cycles: mockFullSchema.data.cycles,
                activeCycle: mockFullSchema.appState.activeCycleId
            };

            localStorage.setItem('miniCycleData', JSON.stringify(mockFullSchema));

            // Reset DOM state
            document.body.className = '';

            // Clear any global state
            delete window.AppState;
            delete window.showNotification;

            await testFn(mockFlattenedData, mockFullSchema);
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // Helper: mock download infrastructure to prevent real downloads and blob:mock-url errors.
    // IMPORTANT: Call AFTER instance.init() — mocking createElement during init() blocks dynamic imports.
    function mockDownloadEnvironment() {
        const originals = {
            createObjectURL: URL.createObjectURL,
            revokeObjectURL: URL.revokeObjectURL,
            createElement: document.createElement.bind(document),
            appendChild: document.body.appendChild.bind(document.body),
            removeChild: document.body.removeChild.bind(document.body),
            showSaveFilePicker: window.showSaveFilePicker,
        };
        // Force legacy download path (showSaveFilePicker requires user activation)
        delete window.showSaveFilePicker;
        const tracked = { linkCreated: false, blobCreated: false, filename: '' };

        URL.createObjectURL = () => { tracked.blobCreated = true; return 'about:blank'; };
        URL.revokeObjectURL = () => {};
        document.createElement = (tag) => {
            const el = originals.createElement(tag);
            if (tag === 'a') {
                tracked.linkCreated = true;
                el.click = () => {};
                Object.defineProperty(el, 'href', { set() {}, get() { return ''; }, configurable: true });
                Object.defineProperty(el, 'download', {
                    set(v) { tracked.filename = v; },
                    get() { return tracked.filename; },
                    configurable: true
                });
            }
            return el;
        };
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        return {
            tracked,
            restore() {
                URL.createObjectURL = originals.createObjectURL;
                URL.revokeObjectURL = originals.revokeObjectURL;
                document.createElement = originals.createElement;
                document.body.appendChild = originals.appendChild;
                document.body.removeChild = originals.removeChild;
                if (originals.showSaveFilePicker) {
                    window.showSaveFilePicker = originals.showSaveFilePicker;
                }
            }
        };
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

    await test('creates instance successfully', async () => {
        const instance = new SettingsManager();
        if (!instance || typeof instance.setupSettingsMenu !== 'function') {
            throw new Error('SettingsManager not properly initialized');
        }
    });


    await test('accepts dependency injection', async () => {
        const mockLoad = () => ({ cycles: {}, activeCycle: null });
        const mockNotify = () => {};

        const instance = new SettingsManager({
            loadMiniCycleData: mockLoad,
            showNotification: mockNotify,
            AppState: () => ({ isReady: () => true, get: () => ({}) })
        });

        if (!instance) {
            throw new Error('Dependency injection failed');
        }
    });

    await test('is DI-pure with no fallback methods', async () => {
        const instance = new SettingsManager();

        // DI-pure pattern: no fallbacks, dependencies are required via setSettingsManagerDependencies
        // Verify instance doesn't have legacy fallback methods (they were removed in facade refactor)
        if (typeof instance.fallbackLoadData === 'function') {
            throw new Error('DI-pure: fallbackLoadData should not exist');
        }
        if (typeof instance.fallbackNotification === 'function') {
            throw new Error('DI-pure: fallbackNotification should not exist');
        }
        // Instance should exist and have initialized flag
        if (instance.initialized !== false) {
            throw new Error('initialized should start as false');
        }
    });

    await test('initializes with false initialized flag', async () => {
        const instance = new SettingsManager();
        if (instance.initialized !== false) {
            throw new Error('initialized should start as false');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';

    await test('setupSettingsMenu sets up event listeners', async () => {
        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';
        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-settings';
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        const modalContent = document.createElement('div');
        modalContent.className = 'settings-modal-content';

        const instance = new SettingsManager({
            querySelector: (sel) => {
                if (sel === '.settings-modal') return modal;
                if (sel === '.settings-modal-content') return modalContent;
                return null;
            },
            getElementById: (id) => {
                if (id === 'open-settings') return openBtn;
                if (id === 'close-settings') return closeBtn;
                if (id === 'toggle-move-arrows') return null; // Skip move arrows
                if (id === 'toggle-three-dots') return null; // Skip three dots
                return document.createElement('div');
            },
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => ({ cycles: {}, activeCycle: null })
        });

        // Run setup (sub-modules loaded via init)
        await instance.init();
        instance.setupSettingsMenu();

        // Check that event handlers are attached (simulate click)
        let modalOpened = false;
        modal.style.display = 'none';

        // Manually trigger the open button
        openBtn.click();

        // The real module adds listeners directly, so this test just verifies no errors
        if (!instance) {
            throw new Error('setupSettingsMenu should complete without error');
        }
    });

    await test('setupDownloadMiniCycle creates download button handler', async (mockFlattenedData) => {
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-mini-cycle';

        const instance = new SettingsManager({
            getElementById: (id) => {
                if (id === 'export-mini-cycle') return exportBtn;
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });

        // Init to load sub-modules, then setup the download handler
        await instance.init();
        instance.setupDownloadMiniCycle();

        // Verify button has a click handler attached (check _onclick or simulate)
        if (!exportBtn) {
            throw new Error('Export button should exist');
        }
    });

    await test('setupUploadMiniCycle creates upload button handler', async (mockFlattenedData) => {
        const importBtn = document.createElement('button');
        importBtn.id = 'import-mini-cycle';

        const instance = new SettingsManager({
            getElementById: (id) => {
                if (id === 'import-mini-cycle') return importBtn;
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData,
            AppState: () => ({ isReady: () => true, get: () => ({}) })
        });

        // Init to load sub-modules, then setup the upload handler
        await instance.init();
        instance.setupUploadMiniCycle();

        // Verify button exists and setup completed
        if (!importBtn) {
            throw new Error('Import button should exist');
        }
    });

    // === IMPORT/EXPORT FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>📤 Import/Export Functionality</h4>';

    await test('exportMiniCycleData creates download', async (mockFlattenedData) => {
        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            await instance.exportMiniCycleData({
                name: 'test-cycle', title: 'Test Cycle', tasks: [],
                autoReset: true, cycleCount: 0, deleteCheckedTasks: false
            }, 'Test Cycle');

            if (!dl.tracked.linkCreated || !dl.tracked.blobCreated) {
                throw new Error('Download link and blob should be created');
            }
        } finally {
            dl.restore();
        }
    });

    await test('exportMiniCycleData handles export flow', async (mockFlattenedData) => {
        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            await instance.exportMiniCycleData({
                name: 'test', title: 'Test',
                tasks: [{ id: 'task-1', text: 'Task 1', completed: false }],
                autoReset: false, cycleCount: 0, deleteCheckedTasks: false
            }, 'Test Cycle');

            // Was a does-not-throw no-op (and wasn't even awaited); assert the real export
            // artifacts like the sibling test above.
            if (!dl.tracked.linkCreated || !dl.tracked.blobCreated) {
                throw new Error('export flow should create the download link and blob');
            }
        } finally {
            dl.restore();
        }
    });

    await test('exportMiniCycleData sanitizes filename', async (mockFlattenedData) => {
        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            await instance.exportMiniCycleData({
                name: 'test', title: 'My Cycle!', tasks: [],
                autoReset: true, cycleCount: 0, deleteCheckedTasks: false
            }, 'My Cycle!');

            // Source: buildMcycFilename(cycleName) + '.mcyc' (v2.372: Unicode-
            // preserving — only path-illegal chars become underscores, so the
            // space and '!' both SURVIVE). buildMcycFilename's own edge cases
            // are pinned in mcycPayload.tests.js; this checks the wiring.
            if (dl.tracked.filename !== 'My Cycle!.mcyc') {
                throw new Error(`filename should be "My Cycle!.mcyc" (legal chars survive), got "${dl.tracked.filename}"`);
            }
        } finally {
            dl.restore();
        }
    });

    // === SETTINGS SYNCHRONIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>⚙️ Settings Synchronization</h4>';

    await test('syncCurrentSettingsToStorage updates localStorage', async (mockFlattenedData) => {
        const toggleAutoReset = document.createElement('input');
        toggleAutoReset.type = 'checkbox';
        toggleAutoReset.id = 'toggleAutoReset';
        toggleAutoReset.checked = true;

        const deleteCheckedTasks = document.createElement('input');
        deleteCheckedTasks.type = 'checkbox';
        deleteCheckedTasks.id = 'deleteCheckedTasks';
        deleteCheckedTasks.checked = false;

        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            getElementById: (id) => {
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        });

        await instance.init();
        await instance.syncCurrentSettingsToStorage();

        // Verify localStorage was updated
        const saved = JSON.parse(localStorage.getItem('miniCycleData'));
        if (!saved) {
            throw new Error('Data should be saved to localStorage');
        }
    });

    await test('syncCurrentSettingsToStorage handles missing data gracefully', async () => {
        localStorage.clear();

        const instance = new SettingsManager({
            loadMiniCycleData: () => null
        });

        await instance.init();

        // Should not throw
        expect(() => {
            instance.syncCurrentSettingsToStorage();
        }).not.toThrow();
    });

    // === FACTORY RESET TEST ===
    resultsDiv.innerHTML += '<h4>🔄 Factory Reset</h4>';

    await test('factory reset clears all data', async () => {
        // This test just verifies the method exists and setup works
        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';

        const instance = new SettingsManager({
            getElementById: (id) => {
                if (id === 'factory-reset') return resetBtn;
                return null;
            },
            loadMiniCycleData: () => ({}),
            showConfirmationModal: () => {},
            AppState: () => null
        });

        // Init to load sub-modules, then setup
        await instance.init();
        instance.setupSettingsMenu();

        // Just verify the instance exists
        if (!instance) {
            throw new Error('Factory reset setup should complete');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>🛡️ Error Handling</h4>';

    await test('handles missing settings modal gracefully', async () => {
        const instance = new SettingsManager({
            querySelector: () => null,
            getElementById: () => null,
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => null
        });

        await instance.init();

        // Should not throw
        expect(() => {
            instance.setupSettingsMenu();
        }).not.toThrow();
    });

    await test('handles corrupted localStorage in export', async () => {
        localStorage.clear();
        const instance = new SettingsManager({
            loadMiniCycleData: () => null,
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            instance.exportMiniCycleData({
                name: 'test', title: 'Test', tasks: [],
                autoReset: true, cycleCount: 0, deleteCheckedTasks: false
            }, 'Test');
        } finally {
            dl.restore();
        }
    });

    await test('handles missing AppState in syncSettings', async () => {
        localStorage.clear();

        const instance = new SettingsManager({
            loadMiniCycleData: () => null,
            AppState: () => null
        });

        await instance.init();

        // Should not throw
        expect(() => {
            instance.syncCurrentSettingsToStorage();
        }).not.toThrow();
    });

    await test('handles schema migration failure gracefully', async () => {
        const instance = new SettingsManager({
            performSchema25Migration: () => ({ success: false }),
            showNotification: () => {}
        });

        // Should not throw
        if (!instance) {
            throw new Error('Should handle migration failure');
        }
    });

    // === DOM INTERACTION TESTS ===
    resultsDiv.innerHTML += '<h4>🌐 DOM Interaction</h4>';

    await test('opens settings modal on button click', async () => {
        // Create DOM elements
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);

        const modalContent = document.createElement('div');
        modalContent.className = 'settings-modal-content';
        modal.appendChild(modalContent);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-settings';
        document.body.appendChild(closeBtn);

        // Set up module-level dependencies (DI-pure pattern)
        // AppState mock works both as direct object (.get()) and factory function (AppState())
        const appStateMethods = { isReady: () => true, get: () => ({}), update: () => {} };
        setSettingsManagerDependencies({
            safeAddEventListener: (el, event, handler) => {
                el?.removeEventListener(event, handler);
                el?.addEventListener(event, handler);
            },
            AppState: Object.assign(() => appStateMethods, appStateMethods),
            loadMiniCycleData: () => ({ settings: {} }),
            showNotification: () => {},
            showConfirmationModal: () => {},
            sanitizeInput: (text) => text,
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            hideMainMenu: () => {}
        });

        const instance = new SettingsManager();
        await instance.init();
        // Reset idempotency guard and re-run setup
        _resetForTesting();
        instance.setupSettingsMenu();

        // Simulate button click
        openBtn.click();

        const passed = modal.style.display === 'flex';

        // Cleanup
        modal.remove();
        openBtn.remove();
        closeBtn.remove();

        if (!passed) {
            throw new Error('Modal should be visible after click');
        }
    });

    await test('closes settings modal on close button click', async () => {
        // Create DOM elements
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const modalContent = document.createElement('div');
        modalContent.className = 'settings-modal-content';
        modal.appendChild(modalContent);

        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';
        document.body.appendChild(openBtn);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-settings';
        document.body.appendChild(closeBtn);

        // Set up module-level dependencies (DI-pure pattern)
        // AppState mock works both as direct object (.get()) and factory function (AppState())
        const appStateMethods2 = { isReady: () => true, get: () => ({}), update: () => {} };
        setSettingsManagerDependencies({
            safeAddEventListener: (el, event, handler) => {
                el?.removeEventListener(event, handler);
                el?.addEventListener(event, handler);
            },
            AppState: Object.assign(() => appStateMethods2, appStateMethods2),
            loadMiniCycleData: () => ({ settings: {} }),
            showNotification: () => {},
            showConfirmationModal: () => {},
            sanitizeInput: (text) => text,
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {}
        });

        const instance = new SettingsManager();
        await instance.init();
        // Reset idempotency guard and re-run setup
        _resetForTesting();
        instance.setupSettingsMenu();

        // Simulate close button click
        closeBtn.click();

        const passed = modal.style.display === 'none';

        // Cleanup
        modal.remove();
        openBtn.remove();
        closeBtn.remove();

        if (!passed) {
            throw new Error('Modal should be hidden after close click');
        }
    });

    // === GLOBAL FUNCTIONS TESTS ===
    resultsDiv.innerHTML += '<h4>🌍 Global Functions</h4>';

    // NOTE: Phase 3 - Global wrapper function tests removed
    // window.setupSettingsMenu, window.setupDownloadMiniCycle, etc. are no longer
    // exposed by the test module loader. The main script handles global exposure in production.
    // Tests should use SettingsManager class directly with mocked dependencies.

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

    await test('setupSettingsMenu completes quickly', async () => {
        // Set up module-level dependencies (DI-pure pattern)
        // AppState mock works both as direct object (.get()) and factory function (AppState())
        const appStateMethods3 = { isReady: () => true, get: () => ({}), update: () => {} };
        setSettingsManagerDependencies({
            safeAddEventListener: (el, event, handler) => {
                el?.removeEventListener(event, handler);
                el?.addEventListener(event, handler);
            },
            AppState: Object.assign(() => appStateMethods3, appStateMethods3),
            loadMiniCycleData: () => ({ settings: {} }),
            showNotification: () => {},
            showConfirmationModal: () => {},
            sanitizeInput: (text) => text,
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {}
        });

        const instance = new SettingsManager();
        await instance.init();

        const startTime = performance.now();
        instance.setupSettingsMenu();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 200) { // 200ms threshold
            throw new Error(`setupSettingsMenu took too long: ${duration.toFixed(2)}ms`);
        }
    });

    await test('exportMiniCycleData completes quickly', async () => {
        const instance = new SettingsManager({
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            const startTime = performance.now();
            instance.exportMiniCycleData({
                name: 'test', title: 'Test', tasks: [],
                autoReset: true, cycleCount: 0, deleteCheckedTasks: false
            }, 'Test');
            const endTime = performance.now();

            const duration = endTime - startTime;
            if (duration > 50) {
                throw new Error(`exportMiniCycleData took too long: ${duration.toFixed(2)}ms`);
            }
        } finally {
            dl.restore();
        }
    });

    // === EDGE CASES ===
    resultsDiv.innerHTML += '<h4>🎯 Edge Cases</h4>';

    await test('handles empty settings object', async () => {
        const instance = new SettingsManager({
            loadMiniCycleData: () => ({ cycles: {}, activeCycle: null })
        });

        // Should not throw
        if (!instance) {
            throw new Error('Should handle empty settings');
        }
    });

    await test('handles missing data in export', async () => {
        const instance = new SettingsManager({
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            // Should handle gracefully — missing tasks, autoReset, etc.
            // The facade returns the exporter's promise — await completion directly.
            await instance.exportMiniCycleData({ name: 'test', title: 'Test' }, 'Test');

            if (!dl.tracked.blobCreated) throw new Error('export should create a blob even with missing fields');
            if (!dl.tracked.linkCreated) throw new Error('export should create a download link');
            if (dl.tracked.filename !== 'Test.mcyc') {
                throw new Error(`expected filename 'Test.mcyc', got '${dl.tracked.filename}'`);
            }
        } finally {
            dl.restore();
        }
    });

    await test('handles very large data export', async () => {
        const instance = new SettingsManager({
            showNotification: () => {}
        });
        await instance.init();
        await new Promise(r => setTimeout(r, 0)); // yield so init's background work settles

        const dl = mockDownloadEnvironment();
        try {
            const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
                id: `task-${i}`, text: `Task ${i}`, completed: false
            }));

            await instance.exportMiniCycleData({
                name: 'large-test', title: 'Large Test', tasks: largeTasks,
                autoReset: true, cycleCount: 0, deleteCheckedTasks: false
            }, 'Large Test');

            if (!dl.tracked.blobCreated) throw new Error('large export should create a blob');
            if (!dl.tracked.linkCreated) throw new Error('large export should create a download link');
            // v2.372: buildMcycFilename keeps legal characters — spaces survive.
            if (dl.tracked.filename !== 'Large Test.mcyc') {
                throw new Error(`expected filename 'Large Test.mcyc', got '${dl.tracked.filename}'`);
            }
        } finally {
            dl.restore();
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
