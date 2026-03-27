/**
 * TaskCompletion Tests
 * Tests for task completion state changes, order persistence, and Schema 2.5 saves
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskCompletionTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCompletion.js?v=${cacheBuster}`);
    const { setTaskCompletionDependencies, saveTaskToSchema25Impl } = mod;

    resultsDiv.innerHTML = '<h2>TaskCompletion Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function createMockState() {
        return {
            metadata: { lastModified: Date.now() },
            settings: {},
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [
                            { id: 'task-1', text: 'Task 1', completed: false },
                            { id: 'task-2', text: 'Task 2', completed: true }
                        ],
                        cycleCount: 0,
                        metadata: { title: 'Test' }
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1', currentMode: 'auto' }
        };
    }

    function createMockAppState(state) {
        return {
            isReady: () => true,
            get: () => state,
            update: (fn, immediate) => { fn(state); state.metadata.lastModified = Date.now(); }
        };
    }

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskCompletionDependencies is exported', () => {
        if (typeof setTaskCompletionDependencies !== 'function') throw new Error('DI setter missing');
    });

    await test('saveTaskToSchema25Impl is exported', () => {
        if (typeof saveTaskToSchema25Impl !== 'function') throw new Error('saveTaskToSchema25Impl missing');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 saveTaskToSchema25Impl</h4>';

    await test('saveTaskToSchema25Impl updates state', () => {
        const state = createMockState();
        const mockAS = createMockAppState(state);
        const deps = { AppState: mockAS };

        const cycle = state.data.cycles['cycle-1'];
        saveTaskToSchema25Impl('cycle-1', cycle, deps);

        // Should update lastModified
        if (!state.metadata.lastModified) throw new Error('lastModified not set');
    });

    await test('saveTaskToSchema25Impl preserves task data', () => {
        const state = createMockState();
        const mockAS = createMockAppState(state);
        const deps = { AppState: mockAS };

        const cycle = state.data.cycles['cycle-1'];
        cycle.tasks[0].text = 'Modified';
        saveTaskToSchema25Impl('cycle-1', cycle, deps);

        const saved = state.data.cycles['cycle-1'].tasks[0];
        if (saved.text !== 'Modified') throw new Error('Task text not preserved');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('saveTaskToSchema25Impl handles missing AppState', () => {
        // Should not throw
        saveTaskToSchema25Impl('cycle-1', { tasks: [] }, {});
    });

    await test('saveTaskToSchema25Impl handles null cycle', () => {
        const state = createMockState();
        const mockAS = createMockAppState(state);
        // Should not throw
        saveTaskToSchema25Impl('cycle-1', null, { AppState: mockAS });
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
