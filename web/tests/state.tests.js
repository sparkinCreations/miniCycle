/**
 * State Module Tests (Schema 2.5)
 * Tests for the centralized state management system
 */

import { createStateManager, resetStateManager } from '../modules/core/appState.js';

export async function runStateTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🗄️ State Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

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
        console.log('🔒 Saved original localStorage for individual state test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual state test completed - original localStorage restored');
        }
    }

    async function test(name, testFn) {
        total.count++;

        try {
            // ✅ CRITICAL: Reset singleton state manager before each test
            resetStateManager();

            // Clear test data from previous test
            localStorage.clear();

            // ✅ AWAIT async tests!
            await testFn();

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // Wrap all tests in try-finally to handle restoration properly
    try {

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('creates instance with default dependencies', () => {
        const state = createStateManager();

        if (!state || typeof state.init !== 'function') {
            throw new Error('State manager not properly initialized');
        }
    });

    await test('accepts custom dependencies', () => {
        const customDeps = {
            showNotification: (msg) => msg,
            storage: localStorage,
            loadInitialData: () => null,
            createInitialData: () => ({ test: 'data' })
        };

        const state = createStateManager(customDeps);

        if (!state.deps.showNotification) {
            throw new Error('Custom dependencies not set');
        }
    });

    await test('initializes with null data', () => {
        const state = createStateManager();

        if (state.data !== null && typeof state.data === 'undefined') {
            throw new Error('Data should be null on construction');
        }
    });

    await test('initializes as not ready', () => {
        const state = createStateManager();

        if (state.isReady()) {
            throw new Error('Should not be ready before init');
        }
    });

    await test('sets correct version', () => {
        const state = createStateManager();

        // Check version exists and is in semver format (X.Y or X.Y.Z)
        if (!state.version || !/^\d+\.\d+(\.\d+)?$/.test(state.version)) {
            throw new Error(`Expected valid semver version, got ${state.version}`);
        }
    });

    // === SCHEMA VALIDATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Schema Validation</h4>';

    await test('validates correct Schema 2.5 structure', () => {
        const state = createStateManager();
        const validData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        const isValid = state.validateSchema25Structure(validData);

        if (!isValid) {
            throw new Error('Valid schema not recognized');
        }
    });

    await test('rejects invalid schema version', () => {
        const state = createStateManager();
        const invalidData = {
            schemaVersion: "1.0",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        const isValid = state.validateSchema25Structure(invalidData);

        if (isValid) {
            throw new Error('Invalid schema should be rejected');
        }
    });

    await test('rejects missing data.cycles', () => {
        const state = createStateManager();
        const invalidData = {
            schemaVersion: "2.5",
            data: {},
            appState: { activeCycleId: null }
        };

        const isValid = state.validateSchema25Structure(invalidData);

        if (isValid) {
            throw new Error('Missing cycles should be rejected');
        }
    });

    await test('rejects missing appState', () => {
        const state = createStateManager();
        const invalidData = {
            schemaVersion: "2.5",
            data: { cycles: {} }
        };

        const isValid = state.validateSchema25Structure(invalidData);

        if (isValid) {
            throw new Error('Missing appState should be rejected');
        }
    });

    await test('handles null data gracefully', () => {
        const state = createStateManager();
        const isValid = state.validateSchema25Structure(null);

        if (isValid) {
            throw new Error('Null should not be valid');
        }
    });

    // === ASYNC INIT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Async Initialization</h4>';

    await test('loads existing Schema 2.5 data from localStorage', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: Date.now() },
            data: { cycles: { 'cycle1': { name: 'Test' } } },
            appState: { activeCycleId: 'cycle1' }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        if (!state.isReady()) {
            throw new Error('State should be ready after init');
        }

        if (!state.data || state.data.schemaVersion !== "2.5") {
            throw new Error('Data not loaded correctly');
        }
    });

    await test('returns null when no valid data exists', async () => {
        const state = createStateManager();
        const result = await state.init();

        if (result !== null) {
            throw new Error('Should return null when no data exists');
        }
    });

    await test('handles corrupted localStorage data', async () => {
        localStorage.setItem('miniCycleData', 'invalid json{{{');

        const state = createStateManager();
        const result = await state.init();

        if (result !== null) {
            throw new Error('Should return null for corrupted data');
        }
    });

    await test('prevents double initialization', async () => {
        const mockData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();
        const firstData = state.data;
        await state.init(); // Second call

        if (state.data !== firstData) {
            throw new Error('Double init should not reload data');
        }
    });

    // === GET/READY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📊 State Access</h4>';

    await test('get() returns current data', async () => {
        const mockData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        const data = state.get();

        if (!data || data.schemaVersion !== "2.5") {
            throw new Error('get() did not return correct data');
        }
    });

    await test('isReady() reflects initialization state', async () => {
        const state = createStateManager();

        if (state.isReady()) {
            throw new Error('Should not be ready before init');
        }

        const mockData = {
            schemaVersion: "2.5",
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        await state.init();

        if (!state.isReady()) {
            throw new Error('Should be ready after successful init');
        }
    });

    // === UPDATE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 State Updates</h4>';

    await test('updates state successfully', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        await state.update(data => {
            data.appState.activeCycleId = 'newCycle';
        });

        if (state.data.appState.activeCycleId !== 'newCycle') {
            throw new Error('State not updated');
        }
    });

    await test('marks state as dirty after update', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        await state.update(data => {
            data.appState.activeCycleId = 'test';
        });

        if (!state.isDirty) {
            throw new Error('State should be marked dirty after update');
        }
    });

    await test('updates lastModified timestamp', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        const oldTimestamp = state.data.metadata.lastModified;

        // Wait a bit to ensure timestamp changes
        await new Promise(resolve => setTimeout(resolve, 10));

        await state.update(data => {
            data.appState.activeCycleId = 'test';
        });

        if (state.data.metadata.lastModified <= oldTimestamp) {
            throw new Error('Timestamp not updated');
        }
    });

    await test('rolls back on update error', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: 'original' }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        try {
            await state.update(data => {
                data.appState.activeCycleId = 'changed';
                throw new Error('Test error');
            });
        } catch (error) {
            // Expected
        }

        if (state.data.appState.activeCycleId !== 'original') {
            throw new Error('State not rolled back after error');
        }
    });

    // === SAVE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Persistence</h4>';

    await test('saves state to localStorage', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        await state.update(data => {
            data.appState.activeCycleId = 'saved';
        }, true); // Immediate save

        const saved = JSON.parse(localStorage.getItem('miniCycleData'));

        if (saved.appState.activeCycleId !== 'saved') {
            throw new Error('State not saved to localStorage');
        }
    });

    await test('clears dirty flag after save', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        await state.update(data => {
            data.appState.activeCycleId = 'test';
        }, true);

        if (state.isDirty) {
            throw new Error('Dirty flag should be cleared after save');
        }
    });

    await test('skips save when not dirty', () => {
        const state = createStateManager();
        state.isDirty = false;

        // Should not throw error
        state.save();
    });

    await test('forceSave triggers immediate save', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        await state.update(data => {
            data.appState.activeCycleId = 'forced';
        });

        state.forceSave();

        const saved = JSON.parse(localStorage.getItem('miniCycleData'));

        if (saved.appState.activeCycleId !== 'forced') {
            throw new Error('Force save did not persist');
        }
    });

    // === LISTENER TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">👂 Event Listeners</h4>';

    await test('subscribes to state changes', () => {
        const state = createStateManager();
        let called = false;

        state.subscribe('test', () => { called = true; });

        if (state.getListenerCount('test') !== 1) {
            throw new Error('Listener not added');
        }
    });

    await test('notifies listeners on update', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        let notified = false;
        state.subscribe('test', (newData, oldData) => {
            notified = true;
        });

        await state.update(data => {
            data.appState.activeCycleId = 'changed';
        });

        if (!notified) {
            throw new Error('Listener not notified');
        }
    });

    await test('provides old and new data to listeners', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: 'old' }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        let receivedOld = null;
        let receivedNew = null;

        state.subscribe('test', (newData, oldData) => {
            receivedOld = oldData.appState.activeCycleId;
            receivedNew = newData.appState.activeCycleId;
        });

        await state.update(data => {
            data.appState.activeCycleId = 'new';
        });

        if (receivedOld !== 'old' || receivedNew !== 'new') {
            throw new Error('Old/new data not provided correctly');
        }
    });

    await test('unsubscribes from state changes', () => {
        const state = createStateManager();
        const callback = () => {};

        state.subscribe('test', callback);
        const result = state.unsubscribe('test', callback);

        if (!result) {
            throw new Error('Unsubscribe failed');
        }

        if (state.getListenerCount('test') !== 0) {
            throw new Error('Listener not removed');
        }
    });

    await test('safeSubscribe prevents duplicate listeners', () => {
        const state = createStateManager();
        const callback = () => {};

        state.safeSubscribe('test', callback);
        state.safeSubscribe('test', callback);

        if (state.getListenerCount('test') !== 1) {
            throw new Error('Duplicate listener added');
        }
    });

    await test('unsubscribeAll removes all listeners for key', () => {
        const state = createStateManager();

        state.subscribe('test', () => {});
        state.subscribe('test', () => {});
        state.subscribe('test', () => {});

        const count = state.unsubscribeAll('test');

        if (count !== 3) {
            throw new Error(`Expected 3 listeners removed, got ${count}`);
        }

        if (state.getListenerCount('test') !== 0) {
            throw new Error('Listeners not removed');
        }
    });

    await test('getListenerCount returns correct total', () => {
        const state = createStateManager();

        state.subscribe('key1', () => {});
        state.subscribe('key1', () => {});
        state.subscribe('key2', () => {});

        const total = state.getListenerCount();

        if (total !== 3) {
            throw new Error(`Expected 3 total listeners, got ${total}`);
        }
    });

    await test('handles listener errors gracefully', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        state.subscribe('test', () => {
            throw new Error('Listener error');
        });

        // Should not throw - error handled internally
        await state.update(data => {
            data.appState.activeCycleId = 'test';
        });
    });

    // === HELPER METHOD TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🛠️ Helper Methods</h4>';

    await test('getActiveCycle returns current cycle', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: {
                cycles: {
                    'cycle1': { name: 'Test Cycle', tasks: [] }
                }
            },
            appState: { activeCycleId: 'cycle1' }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        const cycle = state.getActiveCycle();

        if (!cycle || cycle.name !== 'Test Cycle') {
            throw new Error('Active cycle not retrieved');
        }
    });

    await test('getActiveCycle returns null when no active cycle', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        const cycle = state.getActiveCycle();

        if (cycle !== null && cycle !== undefined) {
            throw new Error('Should return null/undefined when no active cycle');
        }
    });

    await test('getTasks returns active cycle tasks', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: {
                cycles: {
                    'cycle1': {
                        name: 'Test',
                        tasks: [{ id: 'task1', text: 'Task 1' }]
                    }
                }
            },
            appState: { activeCycleId: 'cycle1' }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        const tasks = state.getTasks();

        if (!Array.isArray(tasks) || tasks.length !== 1) {
            throw new Error('Tasks not retrieved correctly');
        }
    });

    await test('getTasks returns empty array when no cycle', () => {
        const state = createStateManager();
        const tasks = state.getTasks();

        if (!Array.isArray(tasks) || tasks.length !== 0) {
            throw new Error('Should return empty array');
        }
    });

    await test('setActiveCycle updates active cycle', async () => {
        const mockData = {
            schemaVersion: "2.5",
            metadata: { lastModified: 0 },
            data: {
                cycles: {
                    'cycle1': { name: 'Cycle 1' },
                    'cycle2': { name: 'Cycle 2' }
                }
            },
            appState: { activeCycleId: 'cycle1' }
        };

        localStorage.setItem('miniCycleData', JSON.stringify(mockData));

        const state = createStateManager();
        await state.init();

        await state.setActiveCycle('cycle2');

        if (state.data.appState.activeCycleId !== 'cycle2') {
            throw new Error('Active cycle not changed');
        }
    });

    // === INITIAL STATE CREATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Initial State Creation</h4>';

    await test('creates valid Schema 2.5 initial state', () => {
        const state = createStateManager();
        const initialState = state.createInitialState();

        if (initialState.schemaVersion !== "2.5") {
            throw new Error('Invalid schema version');
        }

        if (!initialState.data || !initialState.data.cycles) {
            throw new Error('Missing data.cycles');
        }

        if (!initialState.appState) {
            throw new Error('Missing appState');
        }
    });

    await test('initial state includes all required properties', () => {
        const state = createStateManager();
        const initialState = state.createInitialState();

        const required = ['metadata', 'settings', 'data', 'appState', 'ui', 'userProgress', 'customReminders'];

        required.forEach(prop => {
            if (!(prop in initialState)) {
                throw new Error(`Missing required property: ${prop}`);
            }
        });
    });

    await test('initial state has correct metadata', () => {
        const state = createStateManager();
        const initialState = state.createInitialState();

        if (!initialState.metadata.createdAt) {
            throw new Error('Missing createdAt timestamp');
        }

        if (!initialState.metadata.lastModified) {
            throw new Error('Missing lastModified timestamp');
        }

        if (initialState.metadata.schemaVersion !== "2.5") {
            throw new Error('Incorrect metadata schemaVersion');
        }
    });

    await test('creates minimal fallback state', () => {
        const state = createStateManager();
        const fallback = state.createMinimalFallbackState();

        if (!state.validateSchema25Structure(fallback)) {
            throw new Error('Fallback state is not valid Schema 2.5');
        }
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    } catch (error) {
        console.error('Error running state tests:', error);
        resultsDiv.innerHTML += `<div class="result fail">❌ Fatal error: ${error.message}</div>`;
    } finally {
        if (!isPartOfSuite) {
            // ⏱️ WAIT for any debounced saves to complete (state manager has 600ms debounce)
            await new Promise(resolve => setTimeout(resolve, 700));
            
            // 🔒 RESTORE REAL APP DATA after individual test complete
            restoreOriginalData();
        }
    }

    return { passed: passed.count, total: total.count };
}
