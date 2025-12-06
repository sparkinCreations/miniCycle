/**
 * ModeManager Tests (DI-Pure)
 * Tests for modules/cycle/modeManager.js
 * Pattern: Resilient Constructor + Module-level DI
 *
 * Uses dependency injection pattern - imports module directly
 *
 * Tests the three cycling modes:
 * - Auto Cycle ↻: Tasks auto-reset when all completed
 * - Manual Cycle ✔︎↻: Tasks reset only on manual button click
 * - To-Do Mode ✓: Tasks are deleted instead of reset
 */

// Import module directly for DI testing
let ModeManager = null;
let setModeManagerDependencies = null;

export async function runModeManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🎯 ModeManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/cycle/modeManager.js');
        ModeManager = module.ModeManager;
        setModeManagerDependencies = module.setModeManagerDependencies;
        resultsDiv.innerHTML = '<h2>🎯 ModeManager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🎯 ModeManager Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    // Check if class is available
    if (!ModeManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ ModeManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    resultsDiv.innerHTML = '<h2>🎯 ModeManager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
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
        console.log('🔒 Saved original localStorage for individual modeManager test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual modeManager test completed - original localStorage restored');
        }
    }

    // Create mock dependencies for DI-pure testing
    function createMockDeps(overrides = {}) {
        const mockSchemaData = {
            metadata: { version: "2.5", lastModified: Date.now() },
            settings: { alwaysShowRecurring: false },
            data: {
                cycles: {
                    'cycle-test-123': {
                        name: 'Test Cycle',
                        tasks: [
                            { id: 'task-1', text: 'Test task 1', completed: false }
                        ],
                        cycleCount: 5,
                        autoReset: true,
                        deleteCheckedTasks: false,
                        recurringTemplates: {}
                    }
                }
            },
            appState: {
                activeCycleId: 'cycle-test-123',
                currentMode: 'auto-cycle'
            },
            userProgress: { cyclesCompleted: 10, totalTasksCompleted: 50 }
        };

        return {
            AppMeta: { version: '1.0.0-test' },
            getAppState: () => ({
                isReady: () => true,
                get: () => mockSchemaData,
                update: (fn) => { fn(mockSchemaData); }
            }),
            loadMiniCycleData: () => ({
                metadata: mockSchemaData.metadata,
                cycles: mockSchemaData.data.cycles,
                activeCycle: mockSchemaData.appState.activeCycleId
            }),
            createTaskButtonContainer: () => {
                const container = document.createElement('div');
                container.className = 'task-options';
                return container;
            },
            setupDueDateButtonInteraction: () => {},
            checkCompleteAllButton: () => {},
            showNotification: () => {},
            helpWindowManager: () => ({ showModeDescription: () => {} }),
            recurringCore: { updateRecurringButtonVisibility: () => {} },
            getElementById: (id) => document.getElementById(id) || document.createElement('div'),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            ...overrides
        };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Reset DOM state
            document.body.className = '';

            // Clear DOM elements
            const existingSelectors = document.querySelectorAll('#mode-selector, #mobile-mode-selector, #toggleAutoReset, #deleteCheckedTasks');
            existingSelectors.forEach(el => el.remove());

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

    await test('ModeManager class exists', async () => {
        if (typeof ModeManager === 'undefined') {
            throw new Error('ModeManager class not found');
        }
    });

    await test('creates instance with DI successfully', async () => {
        const mockDeps = createMockDeps();
        setModeManagerDependencies(mockDeps);
        const manager = new ModeManager();
        if (!manager || typeof manager.init !== 'function') {
            throw new Error('ModeManager not properly initialized');
        }
    });

    await test('accepts constructor dependency injection', async () => {
        const mockDeps = {
            getAppState: () => ({ get: () => ({}) }),
            loadMiniCycleData: () => ({ metadata: { version: '2.5' } }),
            showNotification: () => {},
            getElementById: (id) => document.createElement('div'),
            querySelectorAll: (sel) => []
        };

        const manager = new ModeManager(mockDeps);

        if (!manager.deps.getAppState || !manager.deps.loadMiniCycleData) {
            throw new Error('Dependency injection failed');
        }
    });

    await test('has isInitialized flag set to false initially', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();
        if (manager.isInitialized !== false) {
            throw new Error('isInitialized should be false before init()');
        }
    });

    await test('stores all expected dependencies (DI)', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();
        const expectedDeps = [
            'getAppState',
            'loadMiniCycleData',
            'createTaskButtonContainer',
            'setupDueDateButtonInteraction',
            'checkCompleteAllButton',
            'showNotification',
            'helpWindowManager',
            'getElementById',
            'querySelectorAll'
        ];

        for (const dep of expectedDeps) {
            if (!manager.deps.hasOwnProperty(dep)) {
                throw new Error(`Missing dependency: ${dep}`);
            }
        }
    });

    // === MODE NAME TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Mode Name Mapping (DI)</h4>';

    await test('getModeName returns correct name for auto-cycle (DI)', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();
        const result = manager.getModeName('auto-cycle');
        if (result !== 'Auto Cycle ↻') {
            throw new Error(`Expected 'Auto Cycle ↻', got '${result}'`);
        }
    });

    await test('getModeName returns correct name for manual-cycle (DI)', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();
        const result = manager.getModeName('manual-cycle');
        if (result !== 'Manual Cycle ✔︎↻') {
            throw new Error(`Expected 'Manual Cycle ✔︎↻', got '${result}'`);
        }
    });

    await test('getModeName returns correct name for todo-mode (DI)', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();
        const result = manager.getModeName('todo-mode');
        if (result !== 'To-Do Mode ✓') {
            throw new Error(`Expected 'To-Do Mode ✓', got '${result}'`);
        }
    });

    await test('getModeName returns default for unknown mode (DI)', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();
        const result = manager.getModeName('invalid-mode');
        if (result !== 'Auto Cycle ↻') {
            throw new Error(`Expected default 'Auto Cycle ↻', got '${result}'`);
        }
    });

    // === REFRESH TASK BUTTONS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Refresh Task Buttons (DI)</h4>';

    await test('refreshTaskButtonsForModeChange handles no tasks gracefully (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            querySelectorAll: () => [],
            getElementById: (id) => null
        }));
        const manager = new ModeManager();

        // Should not throw
        await manager.refreshTaskButtonsForModeChange();
    });

    await test('refreshTaskButtonsForModeChange completes without error (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            getAppState: () => null,
            querySelectorAll: () => [],
            getElementById: () => null
        }));
        const manager = new ModeManager();

        // Call the function - should complete without throwing
        await manager.refreshTaskButtonsForModeChange();

        // Wait for the debounce timeout (150ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 200));
    });

    // === SYNC MODE FROM TOGGLES TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Sync Mode From Toggles (DI)</h4>';

    await test('syncModeFromToggles handles missing state gracefully (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            getAppState: () => ({ get: () => null }),
            getElementById: () => null
        }));
        const manager = new ModeManager();

        // Should not throw
        await manager.syncModeFromToggles();
    });

    await test('syncModeFromToggles detects auto-cycle mode correctly (DI)', async () => {
        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        autoReset: true,
                        deleteCheckedTasks: false
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const mockModeSelector = document.createElement('select');
        mockModeSelector.id = 'mode-selector';
        mockModeSelector.innerHTML = `
            <option value="auto-cycle">Auto Cycle</option>
            <option value="manual-cycle">Manual Cycle</option>
            <option value="todo-mode">To-Do Mode</option>
        `;

        const mockMobileModeSelector = mockModeSelector.cloneNode(true);
        mockMobileModeSelector.id = 'mobile-mode-selector';

        const toggleAutoReset = document.createElement('input');
        toggleAutoReset.type = 'checkbox';
        toggleAutoReset.id = 'toggleAutoReset';

        const deleteCheckedTasks = document.createElement('input');
        deleteCheckedTasks.type = 'checkbox';
        deleteCheckedTasks.id = 'deleteCheckedTasks';

        setModeManagerDependencies(createMockDeps({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => {
                if (id === 'mode-selector') return mockModeSelector;
                if (id === 'mobile-mode-selector') return mockMobileModeSelector;
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        }));
        const manager = new ModeManager();

        await manager.syncModeFromToggles();

        if (mockModeSelector.value !== 'auto-cycle') {
            throw new Error(`Expected 'auto-cycle', got '${mockModeSelector.value}'`);
        }
    });

    await test('syncModeFromToggles detects manual-cycle mode correctly (DI)', async () => {
        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        autoReset: false,
                        deleteCheckedTasks: false
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const mockModeSelector = document.createElement('select');
        mockModeSelector.id = 'mode-selector';
        mockModeSelector.innerHTML = `
            <option value="auto-cycle">Auto Cycle</option>
            <option value="manual-cycle">Manual Cycle</option>
            <option value="todo-mode">To-Do Mode</option>
        `;
        document.body.appendChild(mockModeSelector);

        const mockMobileModeSelector = document.createElement('select');
        mockMobileModeSelector.id = 'mobile-mode-selector';
        mockMobileModeSelector.innerHTML = mockModeSelector.innerHTML;
        document.body.appendChild(mockMobileModeSelector);

        const toggleAutoReset = document.createElement('input');
        toggleAutoReset.type = 'checkbox';
        toggleAutoReset.id = 'toggleAutoReset';
        document.body.appendChild(toggleAutoReset);

        const deleteCheckedTasks = document.createElement('input');
        deleteCheckedTasks.type = 'checkbox';
        deleteCheckedTasks.id = 'deleteCheckedTasks';
        document.body.appendChild(deleteCheckedTasks);

        setModeManagerDependencies(createMockDeps({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => document.getElementById(id)
        }));
        const manager = new ModeManager();

        await manager.syncModeFromToggles();

        if (mockModeSelector.value !== 'manual-cycle') {
            throw new Error(`Expected 'manual-cycle', got '${mockModeSelector.value}'`);
        }

        // Cleanup
        mockModeSelector.remove();
        mockMobileModeSelector.remove();
        toggleAutoReset.remove();
        deleteCheckedTasks.remove();
    });

    await test('syncModeFromToggles detects todo-mode correctly (DI)', async () => {
        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        autoReset: false,
                        deleteCheckedTasks: true
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const mockModeSelector = document.createElement('select');
        mockModeSelector.id = 'mode-selector';
        mockModeSelector.innerHTML = `
            <option value="auto-cycle">Auto Cycle</option>
            <option value="manual-cycle">Manual Cycle</option>
            <option value="todo-mode">To-Do Mode</option>
        `;
        document.body.appendChild(mockModeSelector);

        const mockMobileModeSelector = document.createElement('select');
        mockMobileModeSelector.id = 'mobile-mode-selector';
        mockMobileModeSelector.innerHTML = mockModeSelector.innerHTML;
        document.body.appendChild(mockMobileModeSelector);

        const toggleAutoReset = document.createElement('input');
        toggleAutoReset.type = 'checkbox';
        toggleAutoReset.id = 'toggleAutoReset';
        document.body.appendChild(toggleAutoReset);

        const deleteCheckedTasks = document.createElement('input');
        deleteCheckedTasks.type = 'checkbox';
        deleteCheckedTasks.id = 'deleteCheckedTasks';
        document.body.appendChild(deleteCheckedTasks);

        setModeManagerDependencies(createMockDeps({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => document.getElementById(id)
        }));
        const manager = new ModeManager();

        await manager.syncModeFromToggles();

        if (mockModeSelector.value !== 'todo-mode') {
            throw new Error(`Expected 'todo-mode', got '${mockModeSelector.value}'`);
        }

        // Cleanup
        mockModeSelector.remove();
        mockMobileModeSelector.remove();
        toggleAutoReset.remove();
        deleteCheckedTasks.remove();
    });

    await test('syncModeFromToggles updates body classes (DI)', async () => {
        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        autoReset: true,
                        deleteCheckedTasks: false
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const mockModeSelector = document.createElement('select');
        const mockMobileModeSelector = document.createElement('select');
        const toggleAutoReset = document.createElement('input');
        const deleteCheckedTasks = document.createElement('input');

        setModeManagerDependencies(createMockDeps({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => {
                if (id === 'mode-selector') return mockModeSelector;
                if (id === 'mobile-mode-selector') return mockMobileModeSelector;
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        }));
        const manager = new ModeManager();

        await manager.syncModeFromToggles();

        if (!document.body.classList.contains('auto-cycle-mode')) {
            throw new Error('Body class not updated to auto-cycle-mode');
        }
    });

    // === UPDATE STORAGE FROM TOGGLES TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Update Storage From Toggles (DI)</h4>';

    await test('updateStorageFromToggles saves to AppState (DI)', async () => {
        let updateCalled = false;
        let savedData = null;

        const mockAppState = {
            get: () => ({
                data: {
                    cycles: {
                        'cycle-1': {}
                    }
                },
                appState: { activeCycleId: 'cycle-1' }
            }),
            update: (updateFn, immediate) => {
                updateCalled = true;
                const state = {
                    data: {
                        cycles: {
                            'cycle-1': {}
                        }
                    }
                };
                updateFn(state);
                savedData = state.data.cycles['cycle-1'];
            }
        };

        const toggleAutoReset = document.createElement('input');
        toggleAutoReset.type = 'checkbox';
        toggleAutoReset.checked = true;

        const deleteCheckedTasks = document.createElement('input');
        deleteCheckedTasks.type = 'checkbox';
        deleteCheckedTasks.checked = false;

        setModeManagerDependencies(createMockDeps({
            getAppState: () => mockAppState,
            getElementById: (id) => {
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        }));
        const manager = new ModeManager();

        await manager.updateStorageFromToggles();

        if (!updateCalled) {
            throw new Error('AppState.update not called');
        }

        if (!savedData || savedData.autoReset !== true || savedData.deleteCheckedTasks !== false) {
            throw new Error('Data not saved correctly to AppState');
        }
    });

    await test('updateStorageFromToggles handles missing active cycle (DI)', async () => {
        const mockAppState = {
            get: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: null }
            })
        };

        setModeManagerDependencies(createMockDeps({
            getAppState: () => mockAppState,
            getElementById: () => null
        }));
        const manager = new ModeManager();

        // Should not throw
        await manager.updateStorageFromToggles();
    });

    // === UPDATE CYCLE MODE DESCRIPTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Update Cycle Mode Description (DI)</h4>';

    await test('updateCycleModeDescription handles missing loadMiniCycleData (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            loadMiniCycleData: null
        }));
        const manager = new ModeManager();

        // Should not throw
        await manager.updateCycleModeDescription();
    });

    await test('updateCycleModeDescription updates description for auto-cycle (DI)', async () => {
        const descriptionBox = document.createElement('div');
        descriptionBox.id = 'mode-description';
        document.body.appendChild(descriptionBox);

        setModeManagerDependencies(createMockDeps({
            loadMiniCycleData: () => ({
                metadata: { version: '2.5' },
                cycles: {
                    'cycle-1': {
                        autoReset: true,
                        deleteCheckedTasks: false
                    }
                },
                activeCycle: 'cycle-1'
            }),
            getElementById: (id) => {
                if (id === 'mode-description') return descriptionBox;
                return document.getElementById(id);
            }
        }));
        const manager = new ModeManager();

        await manager.updateCycleModeDescription();

        if (!descriptionBox.innerHTML.includes('Auto Cycle Mode')) {
            throw new Error('Description not updated for auto-cycle mode');
        }

        // Cleanup
        descriptionBox.remove();
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling (DI)</h4>';

    await test('handles missing dependencies gracefully (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            getAppState: () => null,
            getElementById: () => null,
            querySelectorAll: () => []
        }));
        const manager = new ModeManager();

        // Should not throw even with null AppState
        await manager.refreshTaskButtonsForModeChange();
        await manager.syncModeFromToggles();
        await manager.updateStorageFromToggles();
        await manager.updateCycleModeDescription();
    });

    await test('handles null AppState gracefully (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            getAppState: () => null,
            getElementById: () => null
        }));
        const manager = new ModeManager();

        // Should not throw
        await manager.syncModeFromToggles();
        await manager.updateStorageFromToggles();
    });

    await test('handles missing DOM elements gracefully (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            getAppState: () => ({ get: () => ({ data: { cycles: {} }, appState: {} }) }),
            getElementById: () => null,
            querySelectorAll: () => []
        }));
        const manager = new ModeManager();

        // Should not throw
        await manager.refreshTaskButtonsForModeChange();
        await manager.syncModeFromToggles();
        await manager.setupModeSelector();
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration Tests (DI)</h4>';

    await test('integrates with injected AppState (DI)', async () => {
        const mockAppState = {
            isReady: () => true,
            get: () => ({
                metadata: { version: '2.5' },
                settings: {},
                data: {
                    cycles: {
                        'cycle-1': {
                            autoReset: true,
                            deleteCheckedTasks: false
                        }
                    }
                },
                appState: { activeCycleId: 'cycle-1' }
            }),
            update: (updateFn, immediate) => {}
        };

        setModeManagerDependencies(createMockDeps({
            getAppState: () => mockAppState,
            getElementById: () => null,
            querySelectorAll: () => []
        }));
        const manager = new ModeManager();

        // Should work with AppState
        await manager.syncModeFromToggles();
    });

    await test('works without AppState (fallback mode) (DI)', async () => {
        setModeManagerDependencies(createMockDeps({
            getAppState: () => null,
            loadMiniCycleData: () => ({
                metadata: { version: '2.5' },
                settings: {},
                cycles: {}
            }),
            getElementById: () => null
        }));
        const manager = new ModeManager();

        // Should work with fallback
        await manager.updateCycleModeDescription();
    });

    // === GLOBAL COMPATIBILITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🌍 Global Wrappers (Backward Compat)</h4>';

    await test('window.ModeManager exists (backward compat)', async () => {
        if (!window.ModeManager) {
            throw new Error('Global ModeManager class not found');
        }
    });

    await test('window.modeManager instance exists (backward compat)', async () => {
        if (!window.modeManager) {
            throw new Error('Global modeManager instance not found');
        }
        if (typeof window.modeManager.getModeName !== 'function') {
            throw new Error('Global instance missing methods');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance Tests (DI)</h4>';

    await test('getModeName completes quickly (DI)', async () => {
        setModeManagerDependencies(createMockDeps());
        const manager = new ModeManager();

        const startTime = performance.now();
        for (let i = 0; i < 1000; i++) {
            manager.getModeName('auto-cycle');
        }
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 100) { // 100ms for 1000 calls
            throw new Error(`getModeName too slow: ${duration.toFixed(2)}ms for 1000 calls`);
        }
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
