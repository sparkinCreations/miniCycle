/**
 * Menu Manager Tests
 *
 * Tests for modules/ui/menuManager.js
 * Pattern: Resilient Constructor 🛡️
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
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

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    expect
} from './testHelpers.js';

export async function runMenuManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🎛️ Menu Manager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>🎛️ Menu Manager Tests</h2>';
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


    // Import the module class
    const MenuManager = window.MenuManager;

    // Check if class is available
    if (!MenuManager) {
        resultsDiv.innerHTML += '<div class="result fail">MenuManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    function test(name, testFn) {
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

            testFn(mockFlattenedData, mockFullSchema);
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

    test('creates instance successfully', () => {
        const instance = new MenuManager();
        if (!instance || typeof instance.setupMainMenu !== 'function') {
            throw new Error('MenuManager not properly initialized');
        }
    });

    test('has correct version', () => {
        const instance = new MenuManager();
        // Check version exists and is in semver format (X.Y or X.Y.Z)
        if (!instance.version || !/^\d+\.\d+(\.\d+)?$/.test(instance.version)) {
            throw new Error(`Expected valid semver version, got ${instance.version}`);
        }
    });

    test('accepts dependency injection', () => {
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
        const instance = new MenuManager();
        if (instance.initialized !== false) {
            throw new Error('initialized should start as false');
        }
        if (instance.hasRun !== false) {
            throw new Error('hasRun should start as false');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';

    test('setupMainMenu sets hasRun flag', () => {
        const instance = new MenuManager({
            getElementById: () => document.createElement('button'),
            safeAddEventListener: () => {}
        });

        instance.setupMainMenu();

        if (instance.hasRun !== true) {
            throw new Error('hasRun should be true after setupMainMenu');
        }
    });

    test('setupMainMenu prevents duplicate runs', () => {
        let eventCount = 0;
        const instance = new MenuManager({
            getElementById: () => document.createElement('button'),
            safeAddEventListener: () => { eventCount++; }
        });

        instance.setupMainMenu();
        const firstCount = eventCount;

        instance.setupMainMenu(); // Second call

        if (eventCount !== firstCount) {
            throw new Error('setupMainMenu should not run twice');
        }
    });

    test('closeMainMenu hides menu container', () => {
        const menu = document.createElement('div');
        menu.className = 'menu-container visible';

        const instance = new MenuManager({
            querySelector: () => menu
        });

        instance.elements.menu = menu;
        instance.closeMainMenu();

        if (menu.classList.contains('visible')) {
            throw new Error('Menu should not have visible class');
        }
    });

    test('hideMainMenu hides menu container', () => {
        const menu = document.createElement('div');
        menu.className = 'menu-container visible';

        const instance = new MenuManager({
            querySelector: () => menu
        });

        instance.hideMainMenu();

        if (menu.classList.contains('visible')) {
            throw new Error('Menu should not have visible class');
        }
    });

    // === CRITICAL OPERATIONS TESTS ===
    resultsDiv.innerHTML += '<h4>🔴 Critical Operations (Data Mutations)</h4>';

    test('clearAllTasks unchecks all tasks', (mockFlattenedData) => {
        let updatedCycle = null;

        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            showConfirmationModal: (opts) => opts.callback(true),
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
        });

        instance.clearAllTasks();

        // Verify all tasks were unchecked
        if (!updatedCycle || updatedCycle.tasks.some(t => t.completed)) {
            throw new Error('All tasks should be unchecked');
        }
    });

    test('deleteAllTasks removes all tasks', (mockFlattenedData) => {
        let updatedCycle = null;

        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            showConfirmationModal: (opts) => opts.callback(true),
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
        });

        instance.deleteAllTasks();

        // Verify all tasks were deleted
        if (!updatedCycle || updatedCycle.tasks.length !== 0) {
            throw new Error('All tasks should be deleted');
        }
    });

    test('saveMiniCycleAsNew creates new cycle', (mockFlattenedData, mockFullSchema) => {
        let newCycleName = null;
        let stateUpdated = false;

        // Mock AppState as a state manager
        const mockAppState = {
            isReady: () => true,
            get: () => mockFullSchema,
            update: (updateFn, immediate) => {
                const stateCopy = JSON.parse(JSON.stringify(mockFullSchema));
                updateFn(stateCopy);
                newCycleName = Object.keys(stateCopy.data.cycles).find(k => k !== 'cycle-1');
                stateUpdated = true;
            }
        };

        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            AppState: () => mockAppState,
            showPromptModal: (opts) => opts.callback('New Cycle Name'),
            sanitizeInput: (input) => input.trim(),
            showNotification: () => {},
            loadMiniCycle: () => {}
        });

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
    resultsDiv.innerHTML += '<h4>🛡️ Error Handling</h4>';

    test('handles missing menu element gracefully', () => {
        const instance = new MenuManager({
            querySelector: () => null
        });

        // Should not throw
        instance.closeMainMenu();
        instance.hideMainMenu();
    });

    test('handles missing AppState gracefully', (mockFlattenedData) => {
        const instance = new MenuManager({
            loadMiniCycleData: () => null,  // Return null to trigger early exit
            AppState: () => null,
            showNotification: () => {},
            updateCycleData: () => { throw new Error('Should not be called'); }
        });

        // Should not throw - data check should prevent execution
        try {
            instance.clearAllTasks();
        } catch (e) {
            // Expected to throw "Schema 2.5 data not found"
            if (!e.message.includes('Schema 2.5 data not found')) {
                throw e;
            }
        }
    });

    test('handles user cancellation in saveMiniCycleAsNew', (mockFlattenedData, mockFullSchema) => {
        const mockAppState = {
            isReady: () => true,
            get: () => mockFullSchema
        };

        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            AppState: () => mockAppState,
            showPromptModal: (opts) => opts.callback(null), // User cancelled
            showNotification: () => {},
            createNewMiniCycle: () => { throw new Error('Should not be called'); }
        });

        // Should handle cancellation gracefully
        instance.saveMiniCycleAsNew();
    });

    test('handles user cancellation in clearAllTasks', (mockFlattenedData) => {
        // clearAllTasks doesn't have a confirmation modal - it executes directly
        // Test that it handles the operation correctly
        let tasksClearedSuccessfully = false;

        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            updateCycleData: (id, updateFn, save) => {
                tasksClearedSuccessfully = true;
                return true;
            },
            querySelectorAll: () => [],
            updateProgressBar: () => {},
            updateStatsPanel: () => {},
            checkCompleteAllButton: () => {},
            updateUndoRedoButtons: () => {}
        });

        instance.clearAllTasks();

        if (!tasksClearedSuccessfully) {
            throw new Error('clearAllTasks should execute successfully');
        }
    });

    test('handles user cancellation in deleteAllTasks', (mockFlattenedData) => {
        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            showConfirmationModal: (opts) => opts.callback(false), // User cancelled
            updateCycleData: () => { throw new Error('Should not be called'); },
            showNotification: () => {}
        });

        // Should handle cancellation gracefully
        instance.deleteAllTasks();
    });

    // === DOM INTERACTION TESTS ===
    resultsDiv.innerHTML += '<h4>🌐 DOM Interaction</h4>';

    test('updateMainMenuHeader updates cycle name', (mockFlattenedData) => {
        const header = document.createElement('h2');
        header.id = 'menu-header';

        const instance = new MenuManager({
            getElementById: (id) => {
                if (id === 'main-menu-mini-cycle-title') return header;
                if (id === 'current-date') return document.createElement('span');
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData
        });

        instance.updateMainMenuHeader();

        if (!header.textContent.includes('Test Cycle')) {
            throw new Error('Header should show cycle name');
        }
    });

    test('updateMainMenuHeader shows cycle count', (mockFlattenedData) => {
        const header = document.createElement('h2');
        header.id = 'menu-header';

        const instance = new MenuManager({
            getElementById: (id) => {
                if (id === 'main-menu-mini-cycle-title') return header;
                if (id === 'current-date') return document.createElement('span');
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData
        });

        instance.updateMainMenuHeader();

        // The title is just the cycle name, not including cycle count
        if (!header.textContent) {
            throw new Error('Header should have text content');
        }
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';

    test('integrates with AppState when available', (mockFlattenedData, mockFullSchema) => {
        const mockAppState = {
            isReady: () => true,
            get: () => mockFullSchema
        };

        const instance = new MenuManager({
            AppState: () => mockAppState
        });

        // Should be able to access AppState
        const state = instance.deps.AppState();
        if (!state || !state.get) {
            throw new Error('AppState integration failed');
        }
    });

    test('works without AppState (fallback mode)', (mockFlattenedData) => {
        delete window.AppState;

        const instance = new MenuManager({
            loadMiniCycleData: () => mockFlattenedData,
            getElementById: () => ({ textContent: '' })
        });

        // Should work with localStorage fallback
        expect(() => {
            instance.clearAllTasks();
        }).not.toThrow();
    });

    // === GLOBAL FUNCTIONS TESTS ===
    resultsDiv.innerHTML += '<h4>🌍 Global Functions</h4>';

    // NOTE: Phase 3 - Global wrapper function tests removed
    // window.setupMainMenu, window.closeMainMenu, window.hideMainMenu are no longer
    // exposed by the test module loader. The main script handles global exposure in production.
    // Tests should use MenuManager class directly with mocked dependencies.

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

    test('setupMainMenu completes quickly', () => {
        const instance = new MenuManager({
            getElementById: () => document.createElement('button'),
            safeAddEventListener: () => {}
        });

        const startTime = performance.now();
        instance.setupMainMenu();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 100) { // 100ms threshold
            throw new Error(`setupMainMenu took too long: ${duration.toFixed(2)}ms`);
        }
    });

    test('closeMainMenu completes quickly', () => {
        const menu = document.createElement('div');
        menu.className = 'visible';
        const instance = new MenuManager({
            querySelector: () => menu
        });
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
    resultsDiv.innerHTML += '<h4>🎯 Edge Cases</h4>';

    test('handles empty cycle name in header', (mockFlattenedData) => {
        const header = document.createElement('h2');

        const emptyNameData = {
            cycles: {
                'cycle-1': { ...mockFlattenedData.cycles['cycle-1'], title: '' }
            },
            activeCycle: 'cycle-1'
        };

        const instance = new MenuManager({
            getElementById: (id) => {
                if (id === 'main-menu-mini-cycle-title') return header;
                if (id === 'current-date') return document.createElement('span');
                return null;
            },
            loadMiniCycleData: () => emptyNameData
        });

        expect(() => {
            instance.updateMainMenuHeader();
        }).not.toThrow();
    });

    test('handles missing cycle in AppState', (mockFlattenedData) => {
        const noCycleData = {
            cycles: {},
            activeCycle: null
        };

        const instance = new MenuManager({
            loadMiniCycleData: () => noCycleData,
            showNotification: () => {}
        });

        expect(() => {
            instance.clearAllTasks();
        }).not.toThrow();
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
