/**
 * TaskCompletion Tests
 * Tests for task completion state changes, order persistence, and Schema 2.5 saves
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskCompletionTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCompletion.js?v=${cacheBuster}`);
    const { setTaskCompletionDependencies, saveTaskToSchema25Impl, handleTaskCompletionChangeImpl } = mod;

    resultsDiv.innerHTML = '<h2>TaskCompletion Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function createMockState() {
        return {
            metadata: { lastModified: Date.now() },
            settings: {},
            data: { routine: {
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
            appState: { activeRoutineId: 'cycle-1', currentMode: 'auto' }
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

        const cycle = state.data.routine['cycle-1'];
        saveTaskToSchema25Impl('cycle-1', cycle, deps);

        // The impl's update callback sets metadata.lastModified (taskCompletion.js). createMockState
        // pre-set it to Date.now(), so the old `if (!lastModified)` was already true before the call.
        if (!state.metadata.lastModified) throw new Error('saveTaskToSchema25Impl should set metadata.lastModified');
    });

    await test('saveTaskToSchema25Impl persists the passed cycle into state', () => {
        const state = createMockState();
        const deps = { AppState: createMockAppState(state) };

        // A SEPARATE cycle object (not the reference already in state), so the assertion proves
        // the impl actually WROTE it. The old test mutated state.data.routine['cycle-1'] directly
        // (same reference) and read it back — a tautology that passes even with deps = {}.
        const newCycle = { title: 'Test', tasks: [{ id: 'task-1', text: 'Rewritten', completed: false }] };
        saveTaskToSchema25Impl('cycle-1', newCycle, deps);

        const saved = state.data.routine['cycle-1'];
        if (saved !== newCycle) throw new Error('impl should assign the passed cycle into state');
        if (saved.tasks[0].text !== 'Rewritten') throw new Error('persisted cycle should carry the passed task data');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    // AppState is required() on the completion path (STATE_TRUTH_MIGRATION #15). A wiring
    // miss used to skip the save silently — the checkbox moved, nothing was stored, no
    // message. It must now fail where it happens.
    await test('saveTaskToSchema25Impl throws when AppState is not wired (no silent skipped save)', () => {
        setTaskCompletionDependencies({ AppState: null });
        let message = null;
        try {
            saveTaskToSchema25Impl('cycle-1', { tasks: [] }, {});
        } catch (error) {
            message = error.message;
        }
        if (!message || !message.includes('isReady')) {
            throw new Error(`expected a TypeError reading isReady, got ${message === null ? 'no throw — the save was skipped silently' : message}`);
        }
    });

    await test('a checkbox change with AppState not wired reports the failure instead of skipping the save', async () => {
        const notes = [];
        setTaskCompletionDependencies({ AppState: null, showNotification: (msg, type) => notes.push(type) });
        const li = document.createElement('li');
        li.className = 'task';
        li.dataset.taskId = 'task-1';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        li.appendChild(checkbox);
        document.body.appendChild(li);
        try {
            await handleTaskCompletionChangeImpl(checkbox, {});
        } finally {
            li.remove();
            setTaskCompletionDependencies({ showNotification: null });
        }
        if (!notes.includes('warning')) {
            throw new Error('no failure notification — a missing AppState was skipped silently again');
        }
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
