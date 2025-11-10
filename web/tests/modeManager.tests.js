/**
 * 🧪 ModeManager Tests
 * Tests for modules/cycle/modeManager.js
 * Pattern: Resilient Constructor 🛡️
 *
 * Tests the three cycling modes:
 * - Auto Cycle ↻: Tasks auto-reset when all completed
 * - Manual Cycle ✔︎↻: Tasks reset only on manual button click
 * - To-Do Mode ✓: Tasks are deleted instead of reset
 */

export async function runModeManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🎯 ModeManager Tests</h2><h3>Running tests...</h3>';
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


    // Import the module class
    const ModeManager = window.ModeManager;

    // Check if class is available
    if (!ModeManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ ModeManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    // ✅ CRITICAL: Mark appInit as ready for tests
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Mock Schema 2.5 data
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    alwaysShowRecurring: false
                },
                data: {
                    cycles: {
                        'cycle-test-123': {
                            name: 'Test Cycle',
                            tasks: [
                                {
                                    id: 'task-1',
                                    text: 'Test task 1',
                                    completed: false,
                                    highPriority: false,
                                    dueDate: null,
                                    remindersEnabled: false,
                                    recurring: false
                                }
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
                userProgress: {
                    cyclesCompleted: 10,
                    totalTasksCompleted: 50
                }
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Reset DOM state
            document.body.className = '';

            // Clear DOM elements
            const existingSelectors = document.querySelectorAll('#mode-selector, #mobile-mode-selector, #toggleAutoReset, #deleteCheckedTasks');
            existingSelectors.forEach(el => el.remove());

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

    await test('creates instance successfully', async () => {
        const manager = new ModeManager();
        if (!manager || typeof manager.init !== 'function') {
            throw new Error('ModeManager not properly initialized');
        }
    });

    await test('accepts dependency injection', async () => {
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
        const manager = new ModeManager();
        if (manager.isInitialized !== false) {
            throw new Error('isInitialized should be false before init()');
        }
    });

    await test('stores all 9 expected dependencies', async () => {
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
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Mode Name Mapping</h4>';

    await test('getModeName returns correct name for auto-cycle', async () => {
        const manager = new ModeManager();
        const result = manager.getModeName('auto-cycle');
        if (result !== 'Auto Cycle ↻') {
            throw new Error(`Expected 'Auto Cycle ↻', got '${result}'`);
        }
    });

    await test('getModeName returns correct name for manual-cycle', async () => {
        const manager = new ModeManager();
        const result = manager.getModeName('manual-cycle');
        if (result !== 'Manual Cycle ✔︎↻') {
            throw new Error(`Expected 'Manual Cycle ✔︎↻', got '${result}'`);
        }
    });

    await test('getModeName returns correct name for todo-mode', async () => {
        const manager = new ModeManager();
        const result = manager.getModeName('todo-mode');
        if (result !== 'To-Do Mode ✓') {
            throw new Error(`Expected 'To-Do Mode ✓', got '${result}'`);
        }
    });

    await test('getModeName returns default for unknown mode', async () => {
        const manager = new ModeManager();
        const result = manager.getModeName('invalid-mode');
        if (result !== 'Auto Cycle ↻') {
            throw new Error(`Expected default 'Auto Cycle ↻', got '${result}'`);
        }
    });

    // === REFRESH TASK BUTTONS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Refresh Task Buttons</h4>';

    await test('refreshTaskButtonsForModeChange handles no tasks gracefully', async () => {
        const manager = new ModeManager({
            querySelectorAll: () => [],
            getElementById: (id) => null
        });

        // Should not throw
        await manager.refreshTaskButtonsForModeChange();
    });

    await test('refreshTaskButtonsForModeChange waits for core', async () => {
        let coreWaited = false;

        // Temporarily override appInit
        const originalWaitForCore = window.appInit.waitForCore;
        window.appInit.waitForCore = async () => {
            coreWaited = true;
        };

        const manager = new ModeManager({
            querySelectorAll: () => [],
            getElementById: () => null
        });

        // Call the function
        await manager.refreshTaskButtonsForModeChange();

        // Wait for the debounce timeout (150ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Restore
        window.appInit.waitForCore = originalWaitForCore;

        if (!coreWaited) {
            throw new Error('refreshTaskButtonsForModeChange did not wait for core');
        }
    });

    await test('refreshTaskButtonsForModeChange tracks success/failure counts', async () => {
        // Create mock task elements
        const mockTask = document.createElement('div');
        mockTask.className = 'task';
        mockTask.dataset.taskId = 'task-1';

        const oldButtonContainer = document.createElement('div');
        oldButtonContainer.className = 'task-options';
        mockTask.appendChild(oldButtonContainer);

        document.body.appendChild(mockTask);

        const manager = new ModeManager({
            querySelectorAll: (sel) => {
                if (sel === '.task') return [mockTask];
                return document.querySelectorAll(sel);
            },
            getElementById: (id) => {
                const el = document.createElement('input');
                el.type = 'checkbox';
                el.checked = false;
                return el;
            },
            createTaskButtonContainer: () => {
                const container = document.createElement('div');
                container.className = 'task-options';
                return container;
            },
            getAppState: () => ({
                get: () => ({
                    settings: {},
                    data: {
                        cycles: {
                            'cycle-test-123': {
                                tasks: [{ id: 'task-1', text: 'Test' }]
                            }
                        }
                    },
                    appState: { activeCycleId: 'cycle-test-123' },
                    reminders: { enabled: false }
                })
            })
        });

        // Should complete without throwing
        await manager.refreshTaskButtonsForModeChange();

        // Cleanup
        mockTask.remove();
    });

    // === SYNC MODE FROM TOGGLES TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Sync Mode From Toggles</h4>';

    await test('syncModeFromToggles handles missing state gracefully', async () => {
        const manager = new ModeManager({
            getAppState: () => ({ get: () => null }),
            getElementById: () => null
        });

        // Should not throw
        await manager.syncModeFromToggles();
    });

    await test('syncModeFromToggles detects auto-cycle mode correctly', async () => {
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

        const manager = new ModeManager({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => {
                if (id === 'mode-selector') return mockModeSelector;
                if (id === 'mobile-mode-selector') return mockMobileModeSelector;
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        });

        await manager.syncModeFromToggles();

        if (mockModeSelector.value !== 'auto-cycle') {
            throw new Error(`Expected 'auto-cycle', got '${mockModeSelector.value}'`);
        }
    });

    await test('syncModeFromToggles detects manual-cycle mode correctly', async () => {
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
        // Add options to make it a valid select
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

        const manager = new ModeManager({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => document.getElementById(id)
        });

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

    await test('syncModeFromToggles detects todo-mode correctly', async () => {
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

        const manager = new ModeManager({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => document.getElementById(id)
        });

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

    await test('syncModeFromToggles updates body classes', async () => {
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

        const manager = new ModeManager({
            getAppState: () => ({ get: () => mockState }),
            getElementById: (id) => {
                if (id === 'mode-selector') return mockModeSelector;
                if (id === 'mobile-mode-selector') return mockMobileModeSelector;
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        });

        await manager.syncModeFromToggles();

        if (!document.body.classList.contains('auto-cycle-mode')) {
            throw new Error('Body class not updated to auto-cycle-mode');
        }
    });

    // === UPDATE STORAGE FROM TOGGLES TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Update Storage From Toggles</h4>';

    await test('updateStorageFromToggles saves to AppState', async () => {
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

        const manager = new ModeManager({
            getAppState: () => mockAppState,
            getElementById: (id) => {
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        });

        await manager.updateStorageFromToggles();

        if (!updateCalled) {
            throw new Error('AppState.update not called');
        }

        if (!savedData || savedData.autoReset !== true || savedData.deleteCheckedTasks !== false) {
            throw new Error('Data not saved correctly to AppState');
        }
    });

    await test('updateStorageFromToggles handles missing active cycle', async () => {
        const mockAppState = {
            get: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: null }
            })
        };

        const manager = new ModeManager({
            getAppState: () => mockAppState,
            getElementById: () => null
        });

        // Should not throw
        await manager.updateStorageFromToggles();
    });

    // === UPDATE CYCLE MODE DESCRIPTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Update Cycle Mode Description</h4>';

    await test('updateCycleModeDescription handles missing loadMiniCycleData', async () => {
        const manager = new ModeManager({
            loadMiniCycleData: null
        });

        // Should not throw
        await manager.updateCycleModeDescription();
    });

    await test('updateCycleModeDescription updates description for auto-cycle', async () => {
        const descriptionBox = document.createElement('div');
        descriptionBox.id = 'mode-description'; // ✅ FIX: Use correct ID
        document.body.appendChild(descriptionBox);

        const manager = new ModeManager({
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
        });

        await manager.updateCycleModeDescription();

        if (!descriptionBox.innerHTML.includes('Auto Cycle Mode')) {
            throw new Error('Description not updated for auto-cycle mode');
        }

        // Cleanup
        descriptionBox.remove();
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';

    await test('handles missing dependencies gracefully', async () => {
        const manager = new ModeManager();

        // Should not throw even with all deps missing
        await manager.refreshTaskButtonsForModeChange();
        await manager.syncModeFromToggles();
        await manager.updateStorageFromToggles();
        await manager.updateCycleModeDescription();
    });

    await test('handles null AppState gracefully', async () => {
        const manager = new ModeManager({
            getAppState: () => null,
            getElementById: () => null
        });

        // Should not throw
        await manager.syncModeFromToggles();
        await manager.updateStorageFromToggles();
    });

    await test('handles missing DOM elements gracefully', async () => {
        const manager = new ModeManager({
            getAppState: () => ({ get: () => ({ data: { cycles: {} }, appState: {} }) }),
            getElementById: () => null,
            querySelectorAll: () => []
        });

        // Should not throw
        await manager.refreshTaskButtonsForModeChange();
        await manager.syncModeFromToggles();
        await manager.setupModeSelector();
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration Tests</h4>';

    await test('integrates with AppState when available', async () => {
        // Mock AppState
        window.AppState = {
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

        const manager = new ModeManager();

        // Should work with AppState
        await manager.syncModeFromToggles();

        delete window.AppState;
    });

    await test('works without AppState (fallback mode)', async () => {
        delete window.AppState;

        const manager = new ModeManager({
            loadMiniCycleData: () => ({
                metadata: { version: '2.5' },
                settings: {},
                cycles: {}
            }),
            getElementById: () => null
        });

        // Should work with localStorage fallback
        await manager.updateCycleModeDescription();
    });

    // === GLOBAL FUNCTIONS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Functions</h4>';

    await test('exposes global compatibility functions after init', async () => {
        // Import the init function
        const cacheBuster = Date.now();
        const { initModeManager } = await import(`../modules/cycle/modeManager.js?v=${cacheBuster}`);

        // Call init to create global exports
        await initModeManager();

        // Check that module exposes expected global functions
        if (typeof window.initializeModeSelector !== 'function') {
            throw new Error('window.initializeModeSelector not found after init');
        }

        if (typeof window.syncModeFromToggles !== 'function') {
            throw new Error('window.syncModeFromToggles not found after init');
        }

        if (typeof window.getModeName !== 'function') {
            throw new Error('window.getModeName not found after init');
        }
    });

    await test('global modeManager instance exists after init', async () => {
        // Import the init function
        const cacheBuster = Date.now();
        const { initModeManager } = await import(`../modules/cycle/modeManager.js?v=${cacheBuster}`);

        // Call init to create global instance
        const instance = await initModeManager();

        if (!window.modeManager) {
            throw new Error('window.modeManager instance not found after init');
        }

        if (window.modeManager !== instance) {
            throw new Error('window.modeManager does not match returned instance');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance Tests</h4>';

    await test('getModeName completes quickly', async () => {
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
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

return { passed: passed.count, total: total.count };
}
