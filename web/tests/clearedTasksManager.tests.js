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
                        // Real Schema 2.5 shape is { entries, totalCleared, autoPruneEnabled }
                        // (the module lazily creates this) — NOT { items }.
                        clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: true },
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
    // 🧪 Record / Prune behavior (real data-logic coverage)
    // The module uses constructor DI and a permanent singleton, so we build a FRESH
    // instance per test with an inspectable AppState (get() returns a mutable state
    // object; update(fn) mutates it in place).
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Record / Prune Behavior</h4>';

    const DAY_MS = 24 * 60 * 60 * 1000;

    function freshMgr(cycle, activeCycleId = 'cycle-1') {
        const state = {
            metadata: { lastModified: Date.now() },
            settings: {},
            data: { cycles: { [activeCycleId]: cycle } },
            appState: { activeCycleId },
            userProgress: {}
        };
        const notifications = [];
        const AppState = {
            isReady: () => true,
            get: () => state,
            update: (fn) => { fn(state); },
            subscribe: () => () => {}
        };
        const mgr = new ClearedTasksManager({
            AppState,
            appInit: createMockAppInit(),
            showNotification: (msg, type) => notifications.push({ msg, type }),
        });
        return { mgr, state, notifications };
    }

    await test('recordClearedTask appends a newest-first entry and bumps totalCleared', () => {
        // Cycle WITHOUT clearedTasks → exercises the lazy init of { entries, totalCleared, autoPruneEnabled }.
        const { mgr } = freshMgr({ tasks: [], deleteCheckedTasks: false });
        mgr.recordClearedTask({ text: 'Buy milk', highPriority: true, dueDate: '2026-08-01' });

        let cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 1) throw new Error(`expected 1 entry, got ${cleared.entries.length}`);
        if (cleared.entries[0].taskText !== 'Buy milk') throw new Error('entry should carry the task text');
        if (cleared.entries[0].wasHighPriority !== true) throw new Error('entry should record high-priority flag');
        if (cleared.entries[0].hadDueDate !== true || cleared.entries[0].dueDate !== '2026-08-01') throw new Error('entry should record the due date');
        if (cleared.totalCleared !== 1) throw new Error('totalCleared should be 1');

        mgr.recordClearedTask({ text: 'Walk dog' });
        cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 2) throw new Error('second record should append');
        if (cleared.entries[0].taskText !== 'Walk dog') throw new Error('newest entry should be at index 0 (unshift)');
        if (cleared.totalCleared !== 2) throw new Error('totalCleared should be 2');
    });

    await test('recordClearedTask stamps clearedInMode from the cycle mode', () => {
        const todo = freshMgr({ tasks: [], deleteCheckedTasks: true });
        todo.mgr.recordClearedTask({ text: 'x' });
        if (todo.mgr.getClearedTasks().entries[0].clearedInMode !== 'todo') throw new Error('deleteCheckedTasks → clearedInMode "todo"');

        const cyc = freshMgr({ tasks: [], deleteCheckedTasks: false });
        cyc.mgr.recordClearedTask({ text: 'x' });
        if (cyc.mgr.getClearedTasks().entries[0].clearedInMode !== 'cycle') throw new Error('cycle mode → clearedInMode "cycle"');
    });

    await test('recordClearedTask auto-prunes entries older than the retention window', () => {
        const old = { id: 'old', taskText: 'old', clearedAt: Date.now() - 91 * DAY_MS };
        const fresh = { id: 'fresh', taskText: 'fresh', clearedAt: Date.now() };
        const { mgr } = freshMgr({
            tasks: [], deleteCheckedTasks: false,
            clearedTasks: { entries: [old, fresh], totalCleared: 2, autoPruneEnabled: true }
        });
        mgr.recordClearedTask({ text: 'new one' });

        const ids = mgr.getClearedTasks().entries.map(e => e.id);
        if (ids.includes('old')) throw new Error('91-day-old entry should be pruned');
        if (!ids.includes('fresh')) throw new Error('fresh entry should survive pruning');
        if (mgr.getClearedTasks().entries[0].taskText !== 'new one') throw new Error('newly recorded entry should be at the front');
    });

    await test('recordClearedTask keeps old entries when autoPrune is disabled', () => {
        const old = { id: 'old', taskText: 'old', clearedAt: Date.now() - 91 * DAY_MS };
        const { mgr } = freshMgr({
            tasks: [],
            clearedTasks: { entries: [old], totalCleared: 1, autoPruneEnabled: false }
        });
        mgr.recordClearedTask({ text: 'new one' });
        if (!mgr.getClearedTasks().entries.some(e => e.id === 'old')) {
            throw new Error('old entry must be kept when autoPruneEnabled is false');
        }
    });

    await test('recording beyond the cap trims entries to the max while counting all', () => {
        const { mgr } = freshMgr({ tasks: [] });
        const tasks = [];
        for (let i = 0; i < 501; i++) tasks.push({ text: `t${i}` });
        mgr.recordMultipleClearedTasks(tasks);

        const cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 500) throw new Error(`entries should be capped at 500, got ${cleared.entries.length}`);
        // totalCleared is a lifetime counter — it counts every recorded task, independent of the cap.
        if (cleared.totalCleared !== 501) throw new Error(`totalCleared should count all 501, got ${cleared.totalCleared}`);
    });

    await test('recordMultipleClearedTasks records the batch; empty batch is a no-op', () => {
        const { mgr } = freshMgr({ tasks: [] });
        mgr.recordMultipleClearedTasks([{ text: 'a' }, { text: 'b' }, { text: 'c' }]);
        let cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 3) throw new Error('should record all 3 tasks');
        if (cleared.totalCleared !== 3) throw new Error('totalCleared should be 3');

        mgr.recordMultipleClearedTasks([]);
        cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 3) throw new Error('empty batch should not change entries');
    });

    await test('clearAll empties entries but preserves the lifetime totalCleared', () => {
        const { mgr, notifications } = freshMgr({
            tasks: [],
            clearedTasks: {
                entries: [{ id: 'a', clearedAt: Date.now() }, { id: 'b', clearedAt: Date.now() }],
                totalCleared: 7, autoPruneEnabled: true
            }
        });
        mgr.clearAll();
        const cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 0) throw new Error('clearAll should empty entries');
        if (cleared.totalCleared !== 7) throw new Error('clearAll must preserve the lifetime totalCleared');
        if (!notifications.some(n => n.type === 'success')) throw new Error('clearAll should surface a success notification');
    });

    await test('removeEntry removes only the matching id and leaves totalCleared', () => {
        const { mgr } = freshMgr({
            tasks: [],
            clearedTasks: {
                entries: [{ id: 'x', clearedAt: Date.now() }, { id: 'y', clearedAt: Date.now() }],
                totalCleared: 2, autoPruneEnabled: true
            }
        });
        mgr.removeEntry('x');
        let cleared = mgr.getClearedTasks();
        if (cleared.entries.length !== 1 || cleared.entries[0].id !== 'y') throw new Error('only entry x should be removed');
        if (cleared.totalCleared !== 2) throw new Error('removeEntry should not change totalCleared');

        mgr.removeEntry('does-not-exist');
        if (mgr.getClearedTasks().entries.length !== 1) throw new Error('removing an unknown id should be a no-op');
    });

    await test('recordClearedTask is a no-op when there is no active cycle', () => {
        const { mgr, state } = freshMgr({ tasks: [] });
        state.appState.activeCycleId = undefined;
        mgr.recordClearedTask({ text: 'orphan' }); // must not throw
        if (mgr.getClearedTasks().entries.length !== 0) throw new Error('nothing should be recorded without an active cycle');
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
