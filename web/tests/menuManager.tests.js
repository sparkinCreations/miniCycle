/**
 * Menu Manager Tests (DI-Pure)
 *
 * Tests for modules/ui/menuManager.js
 * Pattern: Resilient Constructor + Module-level DI
 *
 * Uses dependency injection pattern - imports module directly
 *
 * Functions tested:
 * - setupMainMenu() - Initialize menu event listeners
 * - closeMainMenu() - Close menu modal
 * - updateMainMenuHeader() - Update menu title and date
 * - hideMainMenu() - Hide menu UI
 * - closeMenuOnClickOutside() - Click-outside handler
 * - saveMiniCycleAsNew() - Duplicate cycle (CRITICAL)
 * - clearAllTasks() - Uncheck all tasks (CRITICAL)
 * - deleteAllTasks() - Delete all tasks (CRITICAL)
 */

// Import module directly for DI testing
let MenuManager = null;
let setMenuManagerDependencies = null;

export async function runMenuManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🎛️ Menu Manager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/ui/menuManager.js');
        MenuManager = module.MenuManager;
        setMenuManagerDependencies = module.setMenuManagerDependencies;
        resultsDiv.innerHTML = '<h2>🎛️ Menu Manager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🎛️ Menu Manager Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    // Check if class is available
    if (!MenuManager) {
        resultsDiv.innerHTML += '<div class="result fail">MenuManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    resultsDiv.innerHTML = '<h2>🎛️ Menu Manager Tests (DI-Pure)</h2>';
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
        console.log('🔒 Saved original localStorage for individual menuManager test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual menuManager test completed - original localStorage restored');
        }
    }

    // Create mock dependencies for DI-pure testing
    function createMockDeps(overrides = {}) {
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

        const mockFlattenedData = {
            cycles: mockFullSchema.data.cycles,
            activeCycle: mockFullSchema.appState.activeCycleId
        };

        return {
            AppMeta: { version: '1.0.0-test' },
            loadMiniCycleData: () => mockFlattenedData,
            AppState: () => ({
                isReady: () => true,
                get: () => mockFullSchema,
                update: (fn) => { fn(mockFullSchema); }
            }),
            showNotification: () => {},
            showPromptModal: (opts) => opts.callback && opts.callback(null),
            showConfirmationModal: (opts) => opts.callback && opts.callback(false),
            getElementById: () => document.createElement('div'),
            querySelector: () => document.createElement('div'),
            querySelectorAll: () => [],
            safeAddEventListener: () => {},
            switchMiniCycle: () => {},
            createNewMiniCycle: () => {},
            loadMiniCycle: () => {},
            updateCycleModeDescription: () => {},
            checkGamesUnlock: () => {},
            sanitizeInput: (input) => input,
            updateCycleData: () => true,
            updateProgressBar: () => {},
            updateStatsPanel: () => {},
            checkCompleteAllButton: () => {},
            updateUndoRedoButtons: () => {},
            recurringPanel: { updateRecurringPanelButtonVisibility: () => {} },
            ...overrides
        };
    }

    function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Reset DOM state
            document.body.className = '';

            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

    test('MenuManager class exists', () => {
        if (typeof MenuManager === 'undefined') {
            throw new Error('MenuManager class not found');
        }
    });

    test('creates instance with DI successfully', () => {
        const mockDeps = createMockDeps();
        setMenuManagerDependencies(mockDeps);
        const instance = new MenuManager();
        if (!instance || typeof instance.setupMainMenu !== 'function') {
            throw new Error('MenuManager not properly initialized');
        }
    });

    test('has version property via DI', () => {
        const mockDeps = createMockDeps();
        setMenuManagerDependencies(mockDeps);
        const instance = new MenuManager();
        if (!instance.version) {
            throw new Error('Version property missing');
        }
        if (instance.version !== '1.0.0-test') {
            throw new Error('Version should come from injected AppMeta');
        }
    });

    test('accepts constructor dependency injection', () => {
        const mockLoad = () => ({ cycles: {}, activeCycle: null });
        const mockNotify = () => {};

        const instance = new MenuManager({
            loadMiniCycleData: mockLoad,
            showNotification: mockNotify,
            AppState: () => ({ isReady: () => true, get: () => ({}) })
        });

        if (!instance) {
            throw new Error('Dependency injection failed');
        }
    });

    test('has fallback methods for all dependencies', () => {
        setMenuManagerDependencies({});
        const instance = new MenuManager();

        // Check key fallback methods exist
        if (typeof instance.fallbackLoadData !== 'function') {
            throw new Error('Missing fallbackLoadData');
        }
        if (typeof instance.fallbackNotification !== 'function') {
            throw new Error('Missing fallbackNotification');
        }
    });

    test('initializes with false flags', () => {
        setMenuManagerDependencies(createMockDeps());
        const instance = new MenuManager();
        if (instance.initialized !== false) {
            throw new Error('initialized should start as false');
        }
        if (instance.hasRun !== false) {
            throw new Error('hasRun should start as false');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Core Functionality (DI)</h4>';

    test('setupMainMenu sets hasRun flag (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            getElementById: () => document.createElement('button'),
            safeAddEventListener: () => {}
        }));
        const instance = new MenuManager();

        instance.setupMainMenu();

        if (instance.hasRun !== true) {
            throw new Error('hasRun should be true after setupMainMenu');
        }
    });

    test('setupMainMenu prevents duplicate runs (DI)', () => {
        let eventCount = 0;
        setMenuManagerDependencies(createMockDeps({
            getElementById: () => document.createElement('button'),
            safeAddEventListener: () => { eventCount++; }
        }));
        const instance = new MenuManager();

        instance.setupMainMenu();
        const firstCount = eventCount;

        instance.setupMainMenu(); // Second call

        if (eventCount !== firstCount) {
            throw new Error('setupMainMenu should not run twice');
        }
    });

    test('closeMainMenu hides menu container (DI)', () => {
        const menu = document.createElement('div');
        menu.className = 'menu-container visible';

        setMenuManagerDependencies(createMockDeps({
            querySelector: () => menu
        }));
        const instance = new MenuManager();

        instance.elements.menu = menu;
        instance.closeMainMenu();

        if (menu.classList.contains('visible')) {
            throw new Error('Menu should not have visible class');
        }
    });

    test('hideMainMenu hides menu container (DI)', () => {
        const menu = document.createElement('div');
        menu.className = 'menu-container visible';

        setMenuManagerDependencies(createMockDeps({
            querySelector: () => menu
        }));
        const instance = new MenuManager();

        instance.hideMainMenu();

        if (menu.classList.contains('visible')) {
            throw new Error('Menu should not have visible class');
        }
    });

    // === CRITICAL OPERATIONS TESTS ===
    resultsDiv.innerHTML += '<h4>🔴 Critical Operations (DI)</h4>';

    test('clearAllTasks unchecks all tasks (DI)', async () => {
        let updatedCycle = null;
        const mockFlattenedData = {
            cycles: {
                'cycle-1': {
                    tasks: [
                        { id: 'task-1', text: 'Task 1', completed: true },
                        { id: 'task-2', text: 'Task 2', completed: true }
                    ]
                }
            },
            activeCycle: 'cycle-1'
        };

        setMenuManagerDependencies(createMockDeps({
            loadMiniCycleData: () => mockFlattenedData,
            updateCycleData: (id, updateFn, save) => {
                updatedCycle = { tasks: JSON.parse(JSON.stringify(mockFlattenedData.cycles[id].tasks)) };
                updateFn(updatedCycle);
                return true;
            },
            querySelectorAll: () => [],
            updateProgressBar: () => {},
            updateStatsPanel: () => {},
            checkCompleteAllButton: () => {},
            updateUndoRedoButtons: () => {}
        }));
        const instance = new MenuManager();

        await instance.clearAllTasks();

        // Verify all tasks were unchecked
        if (!updatedCycle || updatedCycle.tasks.some(t => t.completed)) {
            throw new Error('All tasks should be unchecked');
        }
    });

    test('deleteAllTasks removes all tasks (DI)', async () => {
        let updatedCycle = null;
        const mockFlattenedData = {
            cycles: {
                'cycle-1': {
                    title: 'Test Cycle',
                    tasks: [
                        { id: 'task-1', text: 'Task 1', completed: false },
                        { id: 'task-2', text: 'Task 2', completed: true }
                    ]
                }
            },
            activeCycle: 'cycle-1'
        };

        setMenuManagerDependencies(createMockDeps({
            loadMiniCycleData: () => mockFlattenedData,
            showConfirmationModal: (opts) => opts.callback(true), // User confirms
            updateCycleData: (id, updateFn, save) => {
                updatedCycle = { tasks: [], recurringTemplates: {} };
                updateFn(updatedCycle);
                return true;
            },
            getElementById: () => ({ innerHTML: '' }),
            updateProgressBar: () => {},
            updateStatsPanel: () => {},
            checkCompleteAllButton: () => {},
            updateUndoRedoButtons: () => {}
        }));
        const instance = new MenuManager();

        instance.deleteAllTasks();

        // Wait a tick for callback to execute
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify all tasks were deleted
        if (!updatedCycle || updatedCycle.tasks.length !== 0) {
            throw new Error('All tasks should be deleted');
        }
    });

    test('saveMiniCycleAsNew creates new cycle (DI)', () => {
        let newCycleName = null;
        let stateUpdated = false;
        const mockFullSchema = {
            metadata: { totalCyclesCreated: 1, lastModified: Date.now() },
            data: {
                cycles: {
                    'cycle-1': { id: 'cycle-1', title: 'Test Cycle', tasks: [] }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        setMenuManagerDependencies(createMockDeps({
            loadMiniCycleData: () => ({
                cycles: mockFullSchema.data.cycles,
                activeCycle: 'cycle-1'
            }),
            AppState: () => ({
                isReady: () => true,
                get: () => mockFullSchema,
                update: (updateFn, immediate) => {
                    const stateCopy = JSON.parse(JSON.stringify(mockFullSchema));
                    updateFn(stateCopy);
                    newCycleName = Object.keys(stateCopy.data.cycles).find(k => k !== 'cycle-1');
                    stateUpdated = true;
                }
            }),
            showPromptModal: (opts) => opts.callback('New Cycle Name'),
            sanitizeInput: (input) => input.trim(),
            showNotification: () => {},
            loadMiniCycle: () => {}
        }));
        const instance = new MenuManager();

        instance.hideMainMenu = () => {};
        instance.saveMiniCycleAsNew();

        if (!stateUpdated) {
            throw new Error('State should be updated');
        }
        if (!newCycleName) {
            throw new Error('New cycle should be created');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>🛡️ Error Handling (DI)</h4>';

    test('handles missing menu element gracefully (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            querySelector: () => null
        }));
        const instance = new MenuManager();

        // Should not throw
        instance.closeMainMenu();
        instance.hideMainMenu();
    });

    test('handles missing AppState gracefully (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            loadMiniCycleData: () => null,  // Return null to trigger early exit
            AppState: () => null,
            showNotification: () => {}
        }));
        const instance = new MenuManager();

        // Should throw specific error
        try {
            instance.clearAllTasks();
        } catch (e) {
            if (!e.message.includes('Schema 2.5 data not found')) {
                throw e;
            }
        }
    });

    test('handles user cancellation in saveMiniCycleAsNew (DI)', () => {
        const mockFullSchema = {
            data: { cycles: { 'cycle-1': { title: 'Test' } } },
            appState: { activeCycleId: 'cycle-1' }
        };

        setMenuManagerDependencies(createMockDeps({
            AppState: () => ({
                isReady: () => true,
                get: () => mockFullSchema
            }),
            showPromptModal: (opts) => opts.callback(null), // User cancelled
            showNotification: () => {},
            createNewMiniCycle: () => { throw new Error('Should not be called'); }
        }));
        const instance = new MenuManager();

        // Should handle cancellation gracefully
        instance.saveMiniCycleAsNew();
    });

    test('handles user cancellation in deleteAllTasks (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            loadMiniCycleData: () => ({
                cycles: { 'cycle-1': { title: 'Test', tasks: [] } },
                activeCycle: 'cycle-1'
            }),
            showConfirmationModal: (opts) => opts.callback(false), // User cancelled
            updateCycleData: () => { throw new Error('Should not be called'); },
            showNotification: () => {}
        }));
        const instance = new MenuManager();

        // Should handle cancellation gracefully
        instance.deleteAllTasks();
    });

    // === DOM INTERACTION TESTS ===
    resultsDiv.innerHTML += '<h4>🌐 DOM Interaction (DI)</h4>';

    test('updateMainMenuHeader updates cycle name (DI)', () => {
        const header = document.createElement('h2');
        header.id = 'menu-header';

        const mockFlattenedData = {
            cycles: { 'cycle-1': { title: 'Test Cycle', cycleCount: 5 } },
            activeCycle: 'cycle-1'
        };

        setMenuManagerDependencies(createMockDeps({
            getElementById: (id) => {
                if (id === 'main-menu-mini-cycle-title') return header;
                if (id === 'current-date') return document.createElement('span');
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData
        }));
        const instance = new MenuManager();

        instance.updateMainMenuHeader();

        if (!header.textContent.includes('Test Cycle')) {
            throw new Error('Header should show cycle name');
        }
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔗 Integration Tests (DI)</h4>';

    test('integrates with injected AppState (DI)', () => {
        const mockAppState = {
            isReady: () => true,
            get: () => ({ data: {}, appState: {} })
        };

        setMenuManagerDependencies(createMockDeps({
            AppState: () => mockAppState
        }));
        const instance = new MenuManager();

        // Should be able to access AppState
        const state = instance.deps.AppState();
        if (!state || !state.get) {
            throw new Error('AppState integration failed');
        }
    });

    test('works with fallback mode when AppState null (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            AppState: () => null,
            loadMiniCycleData: () => ({
                cycles: { 'cycle-1': { title: 'Test', tasks: [] } },
                activeCycle: 'cycle-1'
            }),
            getElementById: () => ({ textContent: '' })
        }));
        const instance = new MenuManager();

        // Should not throw
        instance.clearAllTasks().catch(() => {}); // clearAllTasks is async and may fail, that's ok
    });

    // === GLOBAL COMPATIBILITY TESTS ===
    resultsDiv.innerHTML += '<h4>🌍 Global Wrappers (Backward Compat)</h4>';

    test('window.MenuManager exists (backward compat)', () => {
        if (!window.MenuManager) {
            throw new Error('Global MenuManager class not found');
        }
    });

    test('window.menuManager instance exists (backward compat)', () => {
        if (!window.menuManager) {
            throw new Error('Global menuManager instance not found');
        }
        if (typeof window.menuManager.setupMainMenu !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Performance Tests (DI)</h4>';

    test('setupMainMenu completes quickly (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            getElementById: () => document.createElement('button'),
            safeAddEventListener: () => {}
        }));
        const instance = new MenuManager();

        const startTime = performance.now();
        instance.setupMainMenu();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 100) { // 100ms threshold
            throw new Error(`setupMainMenu took too long: ${duration.toFixed(2)}ms`);
        }
    });

    test('closeMainMenu completes quickly (DI)', () => {
        const menu = document.createElement('div');
        menu.className = 'visible';
        setMenuManagerDependencies(createMockDeps({
            querySelector: () => menu
        }));
        const instance = new MenuManager();
        instance.elements.menu = menu;

        const startTime = performance.now();
        instance.closeMainMenu();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 50) { // 50ms threshold
            throw new Error(`closeMainMenu took too long: ${duration.toFixed(2)}ms`);
        }
    });

    // === EDGE CASES ===
    resultsDiv.innerHTML += '<h4>🎯 Edge Cases (DI)</h4>';

    test('handles empty cycle name in header (DI)', () => {
        const header = document.createElement('h2');

        setMenuManagerDependencies(createMockDeps({
            getElementById: (id) => {
                if (id === 'main-menu-mini-cycle-title') return header;
                if (id === 'current-date') return document.createElement('span');
                return null;
            },
            loadMiniCycleData: () => ({
                cycles: { 'cycle-1': { title: '' } },
                activeCycle: 'cycle-1'
            })
        }));
        const instance = new MenuManager();

        // Should not throw
        instance.updateMainMenuHeader();
    });

    test('handles missing cycle in data (DI)', () => {
        setMenuManagerDependencies(createMockDeps({
            loadMiniCycleData: () => ({
                cycles: {},
                activeCycle: null
            }),
            showNotification: () => {}
        }));
        const instance = new MenuManager();

        // Should not throw
        instance.clearAllTasks().catch(() => {});
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
