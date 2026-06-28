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
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
