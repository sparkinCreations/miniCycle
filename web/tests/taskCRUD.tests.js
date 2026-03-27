/**
 * TaskCRUD Tests
 * Tests for task creation, editing, deletion, and priority toggle
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskCRUDTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCRUD.js?v=${cacheBuster}`);
    const { setTaskCRUDDependencies, addTaskImpl, toggleTaskPriorityImpl } = mod;

    resultsDiv.innerHTML = '<h2>TaskCRUD Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function createMockState() {
        return {
            metadata: { lastModified: Date.now() },
            settings: { taskLimit: 100 },
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [
                            { id: 'task-1', text: 'Existing', completed: false, priority: false }
                        ],
                        recurringTemplates: [],
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
            update: (fn) => { fn(state); state.metadata.lastModified = Date.now(); }
        };
    }

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskCRUDDependencies is exported', () => {
        if (typeof setTaskCRUDDependencies !== 'function') throw new Error('DI setter missing');
    });

    await test('addTaskImpl is exported', () => {
        if (typeof addTaskImpl !== 'function') throw new Error('addTaskImpl missing');
    });

    await test('toggleTaskPriorityImpl is exported', () => {
        if (typeof toggleTaskPriorityImpl !== 'function') throw new Error('toggleTaskPriorityImpl missing');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">➕ addTaskImpl</h4>';

    await test('addTaskImpl rejects empty text', async () => {
        const state = createMockState();
        const deps = {
            AppState: createMockAppState(state),
            sanitizeInput: (t) => t.trim(),
            validateAndSanitizeTaskInput: (t) => ({ isValid: false, error: 'Empty' }),
            showNotification: () => {},
        };
        setTaskCRUDDependencies(deps);

        const result = await addTaskImpl('', {}, deps);
        // Should return falsy or not add task
        const tasks = state.data.cycles['cycle-1'].tasks;
        if (tasks.length > 1) throw new Error('Should not add empty task');
    });

    await test('addTaskImpl rejects whitespace-only text', async () => {
        const state = createMockState();
        const deps = {
            AppState: createMockAppState(state),
            sanitizeInput: (t) => t.trim(),
            validateAndSanitizeTaskInput: (t) => ({ isValid: false, error: 'Empty' }),
            showNotification: () => {},
        };
        setTaskCRUDDependencies(deps);

        await addTaskImpl('   ', {}, deps);
        const tasks = state.data.cycles['cycle-1'].tasks;
        if (tasks.length > 1) throw new Error('Should not add whitespace task');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('addTaskImpl handles missing AppState', async () => {
        const deps = {
            AppState: null,
            showNotification: () => {},
        };
        setTaskCRUDDependencies(deps);
        // Should not throw
        await addTaskImpl('test', {}, deps);
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
