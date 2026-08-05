/**
 * TaskCycleReset Tests
 * Tests for modules/task/taskCycleReset.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskCycleResetTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCycleReset.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TaskCycleReset Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskCycleResetDependencies is exported as a function', () => {
        if (typeof mod.setTaskCycleResetDependencies !== 'function') throw new Error('Missing export');
    });

    await test('clearAllTimeouts is exported as a function', () => {
        if (typeof mod.clearAllTimeouts !== 'function') throw new Error('Missing export');
    });

    await test('isResetInProgress is exported as a function', () => {
        if (typeof mod.isResetInProgress !== 'function') throw new Error('Missing export');
    });

    await test('resetTasksImpl is exported as a function', () => {
        if (typeof mod.resetTasksImpl !== 'function') throw new Error('Missing export');
    });

    await test('deleteCompletedTasksImpl is exported as a function', () => {
        if (typeof mod.deleteCompletedTasksImpl !== 'function') throw new Error('Missing export');
    });

    await test('markAllTasksCompleteImpl is exported as a function', () => {
        if (typeof mod.markAllTasksCompleteImpl !== 'function') throw new Error('Missing export');
    });

    await test('handleCompleteAllTasksImpl is exported as a function', () => {
        if (typeof mod.handleCompleteAllTasksImpl !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setTaskCycleResetDependencies accepts an object without throwing', () => {
        mod.setTaskCycleResetDependencies({});
    });

    await test('setTaskCycleResetDependencies accepts mock dependencies', () => {
        mod.setTaskCycleResetDependencies({
            AppState: { get: () => ({ settings: {}, appState: {}, data: { cycles: {} } }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('isResetInProgress returns a boolean', () => {
        const result = mod.isResetInProgress();
        if (typeof result !== 'boolean') throw new Error('isResetInProgress should return boolean, got ' + typeof result);
    });

    await test('clearAllTimeouts does not throw', () => {
        try {
            mod.clearAllTimeouts();
        } catch (e) {
            throw new Error('clearAllTimeouts should not throw: ' + e.message);
        }
    });

    await test('setTaskCycleResetDependencies handles null gracefully', () => {
        try {
            mod.setTaskCycleResetDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🗑️ Clear Completed — state-driven (§1.1)</h4>';

    // Regression — ARCH REVIEW FINDINGS §1.1: To-Do "Clear Completed" must decide which
    // tasks to delete from STATE (task.completed), not the DOM checkbox. Build a deliberate
    // divergence so the two sources disagree:
    //   A: completed in STATE, checkbox UNCHECKED   → must be DELETED
    //   B: NOT completed in STATE, checkbox CHECKED → must be KEPT
    // (Both have deleteWhenComplete=true.) Reading the checkbox would invert the outcome.
    await test('deleteCompletedTasksImpl reads completion from state, not the DOM checkbox (§1.1)', async () => {
        const container = document.createElement('div');
        container.id = 'test-clear-completed-state';
        const taskList = document.createElement('ul');
        const mkRow = (id, checked) => {
            const li = document.createElement('li');
            li.className = 'task';
            li.dataset.taskId = id;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checked;
            li.appendChild(cb);
            return li;
        };
        taskList.appendChild(mkRow('A', false)); // completed in state, but checkbox unchecked
        taskList.appendChild(mkRow('B', true));  // incomplete in state, but checkbox checked
        container.appendChild(taskList);
        document.body.appendChild(container);

        const stateObj = {
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [
                { id: 'A', text: 'A', completed: true,  deleteWhenComplete: true },
                { id: 'B', text: 'B', completed: false, deleteWhenComplete: true }
            ] } } },
            userProgress: {}
        };
        let updatedTasks = null;
        const AppState = {
            isReady: () => true,
            get: () => stateObj,
            update: async (producer) => { producer(stateObj); updatedTasks = stateObj.data.cycles.c1.tasks; return stateObj; }
        };

        try {
            await mod.deleteCompletedTasksImpl('c1', stateObj.data.cycles.c1, taskList, { AppState });

            const ids = (updatedTasks || []).map(t => t.id);
            if (ids.includes('A')) throw new Error('Task A (completed in STATE) should have been deleted');
            if (!ids.includes('B')) throw new Error('Task B (incomplete in STATE) should have been kept');
            if (ids.length !== 1) throw new Error(`Expected exactly 1 task remaining, got ${ids.length}: [${ids}]`);
        } finally {
            mod.clearAllTimeouts(); // cancel pending clear-animation timeouts
            container.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">↩️ Undo snapshot at gesture boundary (v2.362)</h4>';

    // Invariant: a batch gesture captures EXACTLY ONE snapshot, at its entry —
    // never zero (Undo would jump past the batch) and never two (Undo would
    // restore a mid-batch intermediate). The reset executor must NOT capture.
    function makeCompleteAllHarness(deleteCheckedTasks) {
        const taskList = document.createElement('ul');
        ['A', 'B'].forEach(id => {
            const li = document.createElement('li');
            li.className = 'task';
            li.dataset.taskId = id;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            li.appendChild(cb);
            taskList.appendChild(li);
        });
        document.body.appendChild(taskList);

        const stateObj = {
            appState: { activeCycleId: 'c1' },
            metadata: { lastModified: 0 },
            data: { cycles: { c1: {
                deleteCheckedTasks,
                autoReset: !deleteCheckedTasks,
                tasks: [
                    { id: 'A', text: 'A', completed: true, deleteWhenComplete: true },
                    { id: 'B', text: 'B', completed: true, deleteWhenComplete: true }
                ],
                recurringTemplates: {}
            } } },
            userProgress: {}
        };
        let snapshotCount = 0;
        const deps = {
            AppState: {
                isReady: () => true,
                get: () => stateObj,
                update: async (producer) => { producer(stateObj); return stateObj; }
            },
            captureStateSnapshot: () => { snapshotCount++; },
            isPerformingUndoRedo: () => false,
            querySelector: (sel) => sel.includes('task-list') || sel.includes('taskList') ? taskList : taskList.querySelector(sel),
            checkMiniCycle: () => {}
        };
        return { taskList, stateObj, deps, snapshots: () => snapshotCount };
    }

    await test('Complete All (To-Do / Clear Completed) actually deletes completed tasks AND captures one snapshot', async () => {
        const h = makeCompleteAllHarness(true);
        try {
            await mod.handleCompleteAllTasksImpl(() => {}, h.deps);
            // EFFECT first: completed tasks must be gone (regression guard — a
            // snapshot-count-only test missed cycle-mode Complete doing nothing).
            const remaining = h.stateObj.data.cycles.c1.tasks.map(t => t.id);
            if (remaining.length !== 0) throw new Error(`completed tasks should be deleted, still have [${remaining}]`);
            if (h.snapshots() !== 1) throw new Error(`expected exactly 1 snapshot, got ${h.snapshots()}`);
        } finally {
            mod.clearAllTimeouts();
            h.taskList.remove();
        }
    });

    await test('Complete All (cycle mode) actually marks tasks complete AND captures one snapshot', async () => {
        const h = makeCompleteAllHarness(false);
        // Start uncompleted so "did it run" is observable
        h.stateObj.data.cycles.c1.tasks.forEach(t => { t.completed = false; });
        let reset = false;
        try {
            await mod.handleCompleteAllTasksImpl(() => { reset = true; }, h.deps);
            // EFFECT: markAllTasksComplete must have run (this is exactly what the
            // isResetting-guard regression silently killed).
            const allComplete = h.stateObj.data.cycles.c1.tasks.every(t => t.completed === true);
            if (!allComplete) throw new Error('cycle-mode Complete must mark all tasks completed');
            if (h.snapshots() !== 1) throw new Error(`expected exactly 1 snapshot, got ${h.snapshots()}`);
        } finally {
            mod.clearAllTimeouts();
            h.taskList.remove();
        }
    });

    await test('resetTasksImpl (effect executor) captures NO snapshot of its own', async () => {
        const taskList = document.createElement('ul');
        document.body.appendChild(taskList);
        const stateObj = {
            appState: { activeCycleId: 'c1' },
            metadata: { lastModified: 0 },
            data: { cycles: { c1: { autoReset: true, tasks: [{ id: 'A', completed: true }], recurringTemplates: {} } } },
            settings: {}, userProgress: {}
        };
        let snapshotCount = 0;
        const deps = {
            AppState: { isReady: () => true, get: () => stateObj, update: async (p) => { p(stateObj); return stateObj; } },
            captureStateSnapshot: () => { snapshotCount++; },
            isPerformingUndoRedo: () => false,
            querySelector: () => taskList,
            querySelectorAll: () => [],
            checkMiniCycle: () => {},
            incrementCycleCount: () => {}
        };
        try {
            await mod.resetTasksImpl(deps);
            // The executor delegates capture to the gesture that called it.
            if (snapshotCount !== 0) throw new Error(`reset executor must not capture; got ${snapshotCount}`);
        } finally {
            mod.clearAllTimeouts();
            taskList.remove();
        }
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
