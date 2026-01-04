/**
 * AppState Tests
 * Tests for modules/core/appState.js
 *
 * Tests state management functionality:
 * - Module exports
 * - MiniCycleState class
 * - Initialization with race condition prevention
 * - State updates with rollback
 * - Subscribe/unsubscribe system
 * - Save with debounce
 * - Schema 2.5 validation
 * - Helper methods
 */

import {
    setupTestEnvironment,
    createMockData
} from './testHelpers.js';

// Module references - populated by dynamic import
let setAppStateDependencies, createStateManager, resetStateManager, getStateManager;

export async function runAppStateTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>AppState Tests</h2><h3>Loading module...</h3>';

    // Dynamic import with cache busting to avoid stale CDN cache
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/core/appState.js?v=${cacheBuster}`);
    setAppStateDependencies = module.setAppStateDependencies;
    createStateManager = module.createStateManager;
    resetStateManager = module.resetStateManager;
    getStateManager = module.getStateManager;

    resultsDiv.innerHTML = '<h2>AppState Tests</h2><h3>Setting up mocks...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>AppState Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // Helper to create Schema 2.5 compliant mock data
    // appState.validateSchema25Structure requires schemaVersion at root level
    function createSchema25MockData() {
        const baseData = createMockData();
        return {
            schemaVersion: "2.5",
            ...baseData
        };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset state manager before each test
            resetStateManager();
            localStorage.clear();

            const mockSchemaData = createSchema25MockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE EXPORTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Exports</h4>';

    await test('setAppStateDependencies is a function', () => {
        if (typeof setAppStateDependencies !== 'function') {
            throw new Error('setAppStateDependencies should be a function');
        }
    });

    await test('createStateManager is a function', () => {
        if (typeof createStateManager !== 'function') {
            throw new Error('createStateManager should be a function');
        }
    });

    await test('resetStateManager is a function', () => {
        if (typeof resetStateManager !== 'function') {
            throw new Error('resetStateManager should be a function');
        }
    });

    await test('getStateManager is a function', () => {
        if (typeof getStateManager !== 'function') {
            throw new Error('getStateManager should be a function');
        }
    });

    await test('createStateManager returns state manager instance', () => {
        const stateManager = createStateManager();
        if (!stateManager) {
            throw new Error('createStateManager should return instance');
        }
    });

    await test('createStateManager returns singleton', () => {
        const first = createStateManager();
        const second = createStateManager();
        if (first !== second) {
            throw new Error('createStateManager should return same instance');
        }
    });

    await test('resetStateManager clears singleton', () => {
        const first = createStateManager();
        resetStateManager();
        const second = createStateManager();
        if (first === second) {
            throw new Error('resetStateManager should clear singleton');
        }
    });

    // === STATE MANAGER PROPERTIES ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ State Manager Properties</h4>';

    await test('state manager has data property', () => {
        const stateManager = createStateManager();
        if (!('data' in stateManager)) {
            throw new Error('stateManager should have data property');
        }
    });

    await test('state manager has isDirty property', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.isDirty !== 'boolean') {
            throw new Error('stateManager.isDirty should be boolean');
        }
    });

    await test('state manager has listeners Map', () => {
        const stateManager = createStateManager();
        if (!(stateManager.listeners instanceof Map)) {
            throw new Error('stateManager.listeners should be a Map');
        }
    });

    await test('state manager has SAVE_DELAY', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.SAVE_DELAY !== 'number') {
            throw new Error('stateManager.SAVE_DELAY should be a number');
        }
    });

    await test('state manager has isInitialized flag', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.isInitialized !== 'boolean') {
            throw new Error('stateManager.isInitialized should be boolean');
        }
    });

    // === INITIALIZATION ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Initialization</h4>';

    await test('init method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.init !== 'function') {
            throw new Error('init should be a function');
        }
    });

    await test('init returns Promise', () => {
        const stateManager = createStateManager();
        const result = stateManager.init();
        if (!(result instanceof Promise)) {
            throw new Error('init should return Promise');
        }
    });

    await test('init loads existing Schema 2.5 data', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        if (!stateManager.data) {
            throw new Error('init should load data');
        }
        if (stateManager.data.schemaVersion !== '2.5') {
            throw new Error('Should load Schema 2.5 data');
        }
    });

    await test('init sets isInitialized to true', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        if (stateManager.isInitialized !== true) {
            throw new Error('init should set isInitialized to true');
        }
    });

    await test('init prevents race conditions with multiple calls', async () => {
        const stateManager = createStateManager();

        // Call init multiple times simultaneously
        const [result1, result2, result3] = await Promise.all([
            stateManager.init(),
            stateManager.init(),
            stateManager.init()
        ]);

        // All should return the same data
        if (result1 !== result2 || result2 !== result3) {
            throw new Error('Multiple init calls should return same data');
        }
    });

    await test('isReady method works correctly', async () => {
        const stateManager = createStateManager();

        if (stateManager.isReady()) {
            throw new Error('isReady should be false before init');
        }

        await stateManager.init();

        if (!stateManager.isReady()) {
            throw new Error('isReady should be true after init');
        }
    });

    await test('get method returns data', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const data = stateManager.get();
        if (!data) {
            throw new Error('get should return data');
        }
        if (data !== stateManager.data) {
            throw new Error('get should return same reference as data property');
        }
    });

    // === SCHEMA VALIDATION ===
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Schema Validation</h4>';

    await test('validateSchema25Structure method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.validateSchema25Structure !== 'function') {
            throw new Error('validateSchema25Structure should be a function');
        }
    });

    await test('validateSchema25Structure validates correct data', () => {
        const stateManager = createStateManager();
        const validData = createSchema25MockData();

        const result = stateManager.validateSchema25Structure(validData);
        if (result !== true) {
            throw new Error('Should validate correct Schema 2.5 data');
        }
    });

    await test('validateSchema25Structure rejects invalid schemaVersion', () => {
        const stateManager = createStateManager();
        const invalidData = createSchema25MockData();
        invalidData.schemaVersion = '1.0';

        const result = stateManager.validateSchema25Structure(invalidData);
        if (result !== false) {
            throw new Error('Should reject wrong schema version');
        }
    });

    await test('validateSchema25Structure rejects missing data property', () => {
        const stateManager = createStateManager();
        const invalidData = { schemaVersion: '2.5', appState: {} };

        const result = stateManager.validateSchema25Structure(invalidData);
        if (result) {
            throw new Error('Should reject missing data property');
        }
    });

    await test('validateSchema25Structure rejects missing appState', () => {
        const stateManager = createStateManager();
        const invalidData = { schemaVersion: '2.5', data: { cycles: {} } };

        const result = stateManager.validateSchema25Structure(invalidData);
        if (result) {
            throw new Error('Should reject missing appState');
        }
    });

    await test('validateSchema25Structure rejects null', () => {
        const stateManager = createStateManager();
        const result = stateManager.validateSchema25Structure(null);
        if (result) {
            throw new Error('Should reject null');
        }
    });

    // === STATE UPDATES ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 State Updates</h4>';

    await test('update method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.update !== 'function') {
            throw new Error('update should be a function');
        }
    });

    await test('update modifies state', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const originalTheme = stateManager.data.settings.theme;
        await stateManager.update(state => {
            state.settings.theme = 'dark';
        });

        if (stateManager.data.settings.theme !== 'dark') {
            throw new Error('update should modify state');
        }
    });

    await test('update sets isDirty flag', async () => {
        const stateManager = createStateManager();
        await stateManager.init();
        stateManager.isDirty = false;

        await stateManager.update(state => {
            state.settings.theme = 'modified';
        });

        if (!stateManager.isDirty) {
            throw new Error('update should set isDirty to true');
        }
    });

    await test('update updates lastModified timestamp', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const originalTimestamp = stateManager.data.metadata.lastModified;
        await new Promise(r => setTimeout(r, 10)); // Small delay

        await stateManager.update(state => {
            state.settings.theme = 'changed';
        });

        if (stateManager.data.metadata.lastModified <= originalTimestamp) {
            throw new Error('update should update lastModified');
        }
    });

    await test('update rollback on error', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const originalTheme = stateManager.data.settings.theme;

        try {
            await stateManager.update(state => {
                state.settings.theme = 'will-fail';
                throw new Error('Intentional error');
            });
        } catch (e) {
            // Expected
        }

        if (stateManager.data.settings.theme !== originalTheme) {
            throw new Error('update should rollback on error');
        }
    });

    await test('update returns result from updateFn', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const result = await stateManager.update(state => {
            return 'custom-result';
        });

        if (result !== 'custom-result') {
            throw new Error('update should return updateFn result');
        }
    });

    // === SAVE FUNCTIONALITY ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Save Functionality</h4>';

    await test('save method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.save !== 'function') {
            throw new Error('save should be a function');
        }
    });

    await test('forceSave method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.forceSave !== 'function') {
            throw new Error('forceSave should be a function');
        }
    });

    await test('scheduleSave method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.scheduleSave !== 'function') {
            throw new Error('scheduleSave should be a function');
        }
    });

    await test('save skips when not dirty', async () => {
        const stateManager = createStateManager();
        await stateManager.init();
        stateManager.isDirty = false;

        const beforeSave = localStorage.getItem('miniCycleData');
        stateManager.save();
        const afterSave = localStorage.getItem('miniCycleData');

        // Should not have changed
        if (beforeSave !== afterSave) {
            throw new Error('save should skip when not dirty');
        }
    });

    await test('save persists when dirty', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        // Modify data and mark dirty
        stateManager.data.settings.theme = 'test-save-theme';
        stateManager.isDirty = true;
        stateManager.save();

        const stored = JSON.parse(localStorage.getItem('miniCycleData'));
        if (stored.settings.theme !== 'test-save-theme') {
            throw new Error('save should persist dirty changes');
        }
    });

    await test('save clears isDirty flag', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        stateManager.data.settings.theme = 'test';
        stateManager.isDirty = true;
        stateManager.save();

        if (stateManager.isDirty !== false) {
            throw new Error('save should clear isDirty flag');
        }
    });

    // === SUBSCRIPTION SYSTEM ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔔 Subscription System</h4>';

    await test('subscribe method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.subscribe !== 'function') {
            throw new Error('subscribe should be a function');
        }
    });

    await test('unsubscribe method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.unsubscribe !== 'function') {
            throw new Error('unsubscribe should be a function');
        }
    });

    await test('safeSubscribe method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.safeSubscribe !== 'function') {
            throw new Error('safeSubscribe should be a function');
        }
    });

    await test('subscribe adds callback', () => {
        const stateManager = createStateManager();
        const callback = () => {};

        const initialCount = stateManager.getListenerCount('test-key');
        stateManager.subscribe('test-key', callback);

        if (stateManager.getListenerCount('test-key') !== initialCount + 1) {
            throw new Error('subscribe should add callback');
        }
    });

    await test('unsubscribe removes callback', () => {
        const stateManager = createStateManager();
        const callback = () => {};

        stateManager.subscribe('test-key', callback);
        const beforeCount = stateManager.getListenerCount('test-key');

        stateManager.unsubscribe('test-key', callback);

        if (stateManager.getListenerCount('test-key') !== beforeCount - 1) {
            throw new Error('unsubscribe should remove callback');
        }
    });

    await test('unsubscribe returns false for unknown key', () => {
        const stateManager = createStateManager();
        const result = stateManager.unsubscribe('nonexistent-key', () => {});

        if (result !== false) {
            throw new Error('unsubscribe should return false for unknown key');
        }
    });

    await test('unsubscribe returns false for unknown callback', () => {
        const stateManager = createStateManager();
        stateManager.subscribe('test-key', () => {});

        const result = stateManager.unsubscribe('test-key', () => {});
        if (result !== false) {
            throw new Error('unsubscribe should return false for unknown callback');
        }
    });

    await test('safeSubscribe prevents duplicates', () => {
        const stateManager = createStateManager();
        const callback = () => {};

        stateManager.safeSubscribe('test-key', callback);
        stateManager.safeSubscribe('test-key', callback);
        stateManager.safeSubscribe('test-key', callback);

        if (stateManager.getListenerCount('test-key') !== 1) {
            throw new Error('safeSubscribe should prevent duplicates');
        }
    });

    await test('unsubscribeAll removes all callbacks for key', () => {
        const stateManager = createStateManager();

        stateManager.subscribe('test-key', () => {});
        stateManager.subscribe('test-key', () => {});
        stateManager.subscribe('test-key', () => {});

        const count = stateManager.unsubscribeAll('test-key');

        if (count !== 3) {
            throw new Error('unsubscribeAll should return correct count');
        }
        if (stateManager.getListenerCount('test-key') !== 0) {
            throw new Error('unsubscribeAll should remove all callbacks');
        }
    });

    await test('getListenerCount returns correct count', () => {
        const stateManager = createStateManager();

        stateManager.subscribe('key1', () => {});
        stateManager.subscribe('key1', () => {});
        stateManager.subscribe('key2', () => {});

        if (stateManager.getListenerCount('key1') !== 2) {
            throw new Error('getListenerCount should return 2 for key1');
        }
        if (stateManager.getListenerCount('key2') !== 1) {
            throw new Error('getListenerCount should return 1 for key2');
        }
        if (stateManager.getListenerCount() !== 3) {
            throw new Error('getListenerCount should return 3 total');
        }
    });

    await test('notifyListeners calls callbacks on update', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        let callbackCalled = false;
        stateManager.subscribe('test', () => {
            callbackCalled = true;
        });

        await stateManager.update(state => {
            state.settings.theme = 'notify-test';
        });

        if (!callbackCalled) {
            throw new Error('notifyListeners should call callbacks');
        }
    });

    await test('notifyListeners passes old and new data', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        let receivedOldData = null;
        let receivedNewData = null;

        stateManager.subscribe('test', (newData, oldData) => {
            receivedOldData = oldData;
            receivedNewData = newData;
        });

        stateManager.data.settings.theme = 'old-theme';
        await stateManager.update(state => {
            state.settings.theme = 'new-theme';
        });

        if (!receivedOldData || !receivedNewData) {
            throw new Error('Callback should receive old and new data');
        }
        if (receivedNewData.settings.theme !== 'new-theme') {
            throw new Error('newData should have updated value');
        }
    });

    // === HELPER METHODS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Helper Methods</h4>';

    await test('getActiveCycle method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.getActiveCycle !== 'function') {
            throw new Error('getActiveCycle should be a function');
        }
    });

    await test('getActiveCycle returns active cycle', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const activeCycle = stateManager.getActiveCycle();

        if (!activeCycle) {
            throw new Error('getActiveCycle should return cycle');
        }
        if (!activeCycle.name) {
            throw new Error('Active cycle should have name');
        }
    });

    await test('getActiveCycle returns null when no data', () => {
        const stateManager = createStateManager();
        stateManager.data = null;

        const result = stateManager.getActiveCycle();
        if (result !== null) {
            throw new Error('getActiveCycle should return null when no data');
        }
    });

    await test('getTasks method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.getTasks !== 'function') {
            throw new Error('getTasks should be a function');
        }
    });

    await test('getTasks returns tasks array', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        const tasks = stateManager.getTasks();

        if (!Array.isArray(tasks)) {
            throw new Error('getTasks should return array');
        }
    });

    await test('setActiveCycle method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.setActiveCycle !== 'function') {
            throw new Error('setActiveCycle should be a function');
        }
    });

    await test('setActiveCycle updates activeCycleId', async () => {
        const stateManager = createStateManager();
        await stateManager.init();

        // Add a second cycle
        stateManager.data.data.cycles['new-cycle'] = {
            id: 'new-cycle',
            name: 'New Cycle',
            tasks: []
        };

        await stateManager.setActiveCycle('new-cycle');

        if (stateManager.data.appState.activeCycleId !== 'new-cycle') {
            throw new Error('setActiveCycle should update activeCycleId');
        }
    });

    await test('createInitialState method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.createInitialState !== 'function') {
            throw new Error('createInitialState should be a function');
        }
    });

    await test('createInitialState returns valid Schema 2.5 structure', () => {
        const stateManager = createStateManager();
        const initial = stateManager.createInitialState();

        if (initial.schemaVersion !== '2.5') {
            throw new Error('Should have schemaVersion 2.5');
        }
        if (!initial.metadata) {
            throw new Error('Should have metadata');
        }
        if (!initial.settings) {
            throw new Error('Should have settings');
        }
        if (!initial.data || !initial.data.cycles) {
            throw new Error('Should have data.cycles');
        }
        if (!initial.appState) {
            throw new Error('Should have appState');
        }
        if (!initial.userProgress) {
            throw new Error('Should have userProgress');
        }
    });

    await test('createMinimalFallbackState method exists', () => {
        const stateManager = createStateManager();
        if (typeof stateManager.createMinimalFallbackState !== 'function') {
            throw new Error('createMinimalFallbackState should be a function');
        }
    });

    await test('createMinimalFallbackState returns valid minimal structure', () => {
        const stateManager = createStateManager();
        const minimal = stateManager.createMinimalFallbackState();

        if (minimal.schemaVersion !== '2.5') {
            throw new Error('Should have schemaVersion 2.5');
        }
        if (!minimal.data || typeof minimal.data.cycles !== 'object') {
            throw new Error('Should have data.cycles object');
        }
        if (!minimal.appState) {
            throw new Error('Should have appState');
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

    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
