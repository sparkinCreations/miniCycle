/**
 * ClearedTasksManager Tests
 * Tests for recording, retrieving, removing, and pruning cleared tasks
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runClearedTasksManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/clearedTasksManager.js?v=${cacheBuster}`);
    const { ClearedTasksManager, setClearedTasksManagerDependencies, initClearedTasksManager } = mod;

    resultsDiv.innerHTML = '<h2>ClearedTasksManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function createMockState(overrides = {}) {
        return {
            metadata: { lastModified: Date.now() },
            settings: {},
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [{ id: 'task-1', text: 'Test task', completed: false }],
                        clearedTasks: { items: [], totalCleared: 0 },
                        history: { events: [] },
                        metadata: { title: 'Test' }
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' },
            userProgress: { cyclesCompleted: 0, totalTasksCleared: 0 },
            ...overrides
        };
    }

    function createMockAppState(stateOverrides = {}) {
        let state = createMockState(stateOverrides);
        return {
            isReady: () => true,
            get: () => state,
            update: (fn) => { fn(state); },
            subscribe: () => () => {}
        };
    }

    function createMockAppInit() {
        return { waitForCore: () => Promise.resolve(), isCoreReady: () => true };
    }

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('ClearedTasksManager class is exported', () => {
        if (typeof ClearedTasksManager !== 'function') throw new Error('Not a class');
    });

    await test('setClearedTasksManagerDependencies is exported', () => {
        if (typeof setClearedTasksManagerDependencies !== 'function') throw new Error('DI setter missing');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Initialization</h4>';

    let mgr;
    await test('initClearedTasksManager creates instance', async () => {
        setClearedTasksManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        mgr = await initClearedTasksManager();
        if (!mgr) throw new Error('Instance not created');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Core Methods Exist</h4>';

    await test('has recordClearedTask method', () => {
        if (typeof mgr.recordClearedTask !== 'function') throw new Error('Missing recordClearedTask');
    });

    await test('has recordMultipleClearedTasks method', () => {
        if (typeof mgr.recordMultipleClearedTasks !== 'function') throw new Error('Missing recordMultipleClearedTasks');
    });

    await test('has getClearedTasks method', () => {
        if (typeof mgr.getClearedTasks !== 'function') throw new Error('Missing getClearedTasks');
    });

    await test('has removeEntry method', () => {
        if (typeof mgr.removeEntry !== 'function') throw new Error('Missing removeEntry');
    });

    await test('has clearAll method', () => {
        if (typeof mgr.clearAll !== 'function') throw new Error('Missing clearAll');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('recordClearedTask handles null task gracefully', () => {
        setClearedTasksManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        // Should not throw
        mgr.recordClearedTask(null);
    });

    await test('recordClearedTask handles undefined task gracefully', () => {
        setClearedTasksManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        // Should not throw
        mgr.recordClearedTask(undefined);
    });

    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
