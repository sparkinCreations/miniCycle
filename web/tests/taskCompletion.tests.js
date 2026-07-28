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

    await test('saveTaskToSchema25Impl updates state (bumps lastModified)', () => {
        const state = createMockState();
        state.metadata.lastModified = 0;   // reset so we can see the impl set it
        const deps = { AppState: createMockAppState(state) };

        const cycle = state.data.cycles['cycle-1'];
        saveTaskToSchema25Impl('cycle-1', cycle, deps);

        // The impl's update callback sets metadata.lastModified (taskCompletion.js). createMockState
        // pre-set it to Date.now(), so the old `if (!lastModified)` was already true before the call.
        if (!state.metadata.lastModified) throw new Error('saveTaskToSchema25Impl should set metadata.lastModified');
    });

    await test('saveTaskToSchema25Impl persists the passed cycle into state', () => {
        const state = createMockState();
        const deps = { AppState: createMockAppState(state) };

        // A SEPARATE cycle object (not the reference already in state), so the assertion proves
        // the impl actually WROTE it. The old test mutated state.data.cycles['cycle-1'] directly
        // (same reference) and read it back — a tautology that passes even with deps = {}.
        const newCycle = { title: 'Test', tasks: [{ id: 'task-1', text: 'Rewritten', completed: false }] };
        saveTaskToSchema25Impl('cycle-1', newCycle, deps);

        const saved = state.data.cycles['cycle-1'];
        if (saved !== newCycle) throw new Error('impl should assign the passed cycle into state');
        if (saved.tasks[0].text !== 'Rewritten') throw new Error('persisted cycle should carry the passed task data');
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
