/**
 * TaskCycleReset Tests
 * Tests for modules/task/taskCycleReset.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskCycleResetTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCycleReset.js?v=${cacheBuster}`);
    // Real signature builder so the snapshot-dedup test mirrors production
    // (a bare counter mock can't see the update-wrapper's captures — the exact
    // blind spot that let the Clear Completed two-snapshot leak ship).
    const { buildSnapshotSignature } = await import(`../modules/ui/undoRedoManager.js?v=${cacheBuster}`);

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
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Recurring tasks are excluded from Clear Completed</h4>';

    // A recurring occurrence is scheduled to come back, so clearing it in To-Do Mode
    // must NOT archive it (Cleared Tasks offered "restore" for something that restores
    // itself) and must NOT count toward cleared-task achievements. Recurring tasks still
    // reach achievements through completed CYCLES — a different path, untouched here.
    //
    // These are two SEPARATE writes to separate state (`cycle.clearedTasks` via
    // recordMultipleClearedTasks, and `userProgress.totalTasksCompleted`), so they get
    // separate tests: a fix that filters only one leaves the other wrong.
    function makeClearHarness(tasks) {
        const container = document.createElement('div');
        const taskList = document.createElement('ul');
        tasks.forEach(t => {
            const li = document.createElement('li');
            li.className = 'task';
            li.dataset.taskId = t.id;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            li.appendChild(cb);
            taskList.appendChild(li);
        });
        container.appendChild(taskList);
        document.body.appendChild(container);

        const stateObj = {
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: tasks.map(t => ({ ...t })) } } },
            userProgress: { totalTasksCompleted: 0 }
        };
        const recorded = [];
        const AppState = {
            isReady: () => true,
            get: () => stateObj,
            update: async (producer) => { producer(stateObj); return stateObj; }
        };
        const deps = {
            AppState,
            recordMultipleClearedTasks: (entries) => recorded.push(...entries)
        };
        return { taskList, stateObj, recorded, deps, cleanup: () => { mod.clearAllTimeouts(); container.remove(); } };
    }

    const RECURRING = { id: 'R', text: 'Recurring', completed: true, deleteWhenComplete: true, recurring: true };
    const PLAIN = { id: 'P', text: 'Plain', completed: true, deleteWhenComplete: true, recurring: false };

    await test('recurring task cleared in To-Do is NOT added to Cleared Tasks', async () => {
        const h = makeClearHarness([RECURRING]);
        try {
            await mod.deleteCompletedTasksImpl('c1', h.stateObj.data.cycles.c1, h.taskList, h.deps);
            if (h.recorded.length !== 0) {
                throw new Error(`archived ${h.recorded.length} recurring task(s); expected 0`);
            }
        } finally { h.cleanup(); }
    });

    await test('recurring task cleared in To-Do does NOT increment totalTasksCompleted', async () => {
        // Deliberately separate from the archive test: different state field, different write.
        const h = makeClearHarness([RECURRING]);
        try {
            await mod.deleteCompletedTasksImpl('c1', h.stateObj.data.cycles.c1, h.taskList, h.deps);
            if (h.stateObj.userProgress.totalTasksCompleted !== 0) {
                throw new Error(`counter went to ${h.stateObj.userProgress.totalTasksCompleted}; expected 0`);
            }
        } finally { h.cleanup(); }
    });

    await test('non-recurring task cleared in To-Do IS archived and counted', async () => {
        const h = makeClearHarness([PLAIN]);
        try {
            await mod.deleteCompletedTasksImpl('c1', h.stateObj.data.cycles.c1, h.taskList, h.deps);
            if (h.recorded.length !== 1) throw new Error(`archived ${h.recorded.length}; expected 1`);
            if (h.recorded[0].text !== 'Plain') throw new Error(`archived the wrong task: ${h.recorded[0].text}`);
            if (h.stateObj.userProgress.totalTasksCompleted !== 1) {
                throw new Error(`counter=${h.stateObj.userProgress.totalTasksCompleted}; expected 1`);
            }
        } finally { h.cleanup(); }
    });

    await test('mixed batch archives and counts only the non-recurring task', async () => {
        const h = makeClearHarness([RECURRING, PLAIN]);
        try {
            await mod.deleteCompletedTasksImpl('c1', h.stateObj.data.cycles.c1, h.taskList, h.deps);
            if (h.recorded.length !== 1) throw new Error(`archived ${h.recorded.length}; expected 1`);
            if (h.recorded[0].text !== 'Plain') throw new Error(`archived ${h.recorded[0].text}; expected Plain`);
            if (h.stateObj.userProgress.totalTasksCompleted !== 1) {
                throw new Error(`counter=${h.stateObj.userProgress.totalTasksCompleted}; expected 1`);
            }
        } finally { h.cleanup(); }
    });

    await test('both recurring and non-recurring are still REMOVED from the task list', async () => {
        // Exclusion is about archiving/counting only — clearing must still clear.
        const h = makeClearHarness([RECURRING, PLAIN]);
        try {
            await mod.deleteCompletedTasksImpl('c1', h.stateObj.data.cycles.c1, h.taskList, h.deps);
            const remaining = h.stateObj.data.cycles.c1.tasks.map(t => t.id);
            if (remaining.length !== 0) throw new Error(`tasks left behind: [${remaining}]`);
        } finally { h.cleanup(); }
    });

    await test('an all-recurring batch performs no archive write at all', async () => {
        // Guards the empty-batch edge: recordMultipleClearedTasks should not be called
        // with an empty array, which would still bump the archive's totalCleared.
        const h = makeClearHarness([RECURRING, { ...RECURRING, id: 'R2', text: 'Recurring 2' }]);
        let recordCalls = 0;
        h.deps.recordMultipleClearedTasks = (entries) => { recordCalls++; h.recorded.push(...entries); };
        try {
            await mod.deleteCompletedTasksImpl('c1', h.stateObj.data.cycles.c1, h.taskList, h.deps);
            if (recordCalls !== 0) throw new Error(`recordMultipleClearedTasks called ${recordCalls}x; expected 0`);
            if (h.stateObj.userProgress.totalTasksCompleted !== 0) {
                throw new Error(`counter=${h.stateObj.userProgress.totalTasksCompleted}; expected 0`);
            }
        } finally { h.cleanup(); }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">↩️ Undo snapshot at gesture boundary (v2.362)</h4>';

    // Invariant: a batch gesture captures EXACTLY ONE snapshot — never zero
    // (Undo jumps past the batch) and never two (Undo lands on a mid-batch
    // phantom). The harness mirrors PRODUCTION: an update-wrapper captures
    // before every AppState.update (like wrapAppStateForUndo), gated by the
    // shared flags object and deduped by the REAL buildSnapshotSignature.
    // A bare counter mock — the old harness — could not see the wrapper's
    // captures and so missed the Clear Completed two-snapshot leak entirely.
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
                title: 'C1',
                deleteCheckedTasks,
                autoReset: !deleteCheckedTasks,
                cycleCount: 0,
                tasks: [
                    { id: 'A', text: 'A', completed: true, deleteWhenComplete: true },
                    { id: 'B', text: 'B', completed: true, deleteWhenComplete: true }
                ],
                recurringTemplates: {},
                clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: true }
            } } },
            userProgress: {}
        };

        // Shared flags object — setResettingFlag / system-mutation write here,
        // and the faithful capture reads here, exactly as AppGlobalState does.
        const flags = { isResetting: false, isSystemMutation: false, isPerformingUndoRedo: false };
        const stack = [];

        // Faithful captureStateSnapshot: flag-gated + real-signature dedup.
        const capture = (raw) => {
            if (flags.isResetting || flags.isSystemMutation || flags.isPerformingUndoRedo) return;
            const cid = raw?.appState?.activeCycleId;
            const cyc = raw?.data?.cycles?.[cid];
            if (!cyc) return;
            const snap = {
                activeCycleId: cid,
                tasks: structuredClone(cyc.tasks || []),
                title: cyc.title || '',
                autoReset: cyc.autoReset,
                deleteCheckedTasks: cyc.deleteCheckedTasks,
                cycleCount: cyc.cycleCount || 0,
                theme: cyc.theme || 'classic',
                recurringTemplates: structuredClone(cyc.recurringTemplates || {}),
                clearedTasks: cyc.clearedTasks ? structuredClone(cyc.clearedTasks) : null
            };
            const sig = buildSnapshotSignature(snap);
            if (stack.length && stack[stack.length - 1].sig === sig) return; // dedup
            stack.push({ sig });
        };

        const AppState = {
            isReady: () => true,
            get: () => stateObj,
            // The wrapper: capture BEFORE running the producer, like production.
            update: async (producer) => { capture(stateObj); producer(stateObj); return stateObj; }
        };

        const deps = {
            AppState,
            AppGlobalState: flags,
            captureStateSnapshot: capture,
            isPerformingUndoRedo: () => false,
            querySelector: (sel) => (sel.includes('task-list') || sel.includes('taskList')) ? taskList : taskList.querySelector(sel),
            checkMiniCycle: () => {},
            // Mirror clearedTasksManager.recordMultipleClearedTasks: its OWN
            // AppState.update bumping totalCleared is the second update whose
            // post-record signature differs from the gesture capture.
            recordMultipleClearedTasks: (records) => {
                AppState.update(s => {
                    const c = s.data.cycles.c1;
                    if (!c.clearedTasks) c.clearedTasks = { entries: [], totalCleared: 0, autoPruneEnabled: true };
                    c.clearedTasks.totalCleared += records.length;
                    c.clearedTasks.entries.unshift(...records.map(r => ({ ...r, id: 'clr-' + r.text })));
                }, true);
            }
        };
        return { taskList, stateObj, deps, flags, snapshots: () => stack.length };
    }

    await test('Clear Completed (To-Do) deletes tasks AND captures exactly one snapshot (no phantom intermediate)', async () => {
        const h = makeCompleteAllHarness(true);
        // recordMultipleClearedTasks is read from module _deps, not passed deps.
        mod.setTaskCycleResetDependencies({
            AppState: h.deps.AppState,
            AppGlobalState: h.flags,
            captureStateSnapshot: h.deps.captureStateSnapshot,
            recordMultipleClearedTasks: h.deps.recordMultipleClearedTasks
        });
        try {
            await mod.handleCompleteAllTasksImpl(() => {}, h.deps);
            const remaining = h.stateObj.data.cycles.c1.tasks.map(t => t.id);
            if (remaining.length !== 0) throw new Error(`completed tasks should be deleted, still have [${remaining}]`);
            // The record→delete sequence must NOT leak a second snapshot. Pre-fix
            // this was 2 (gesture + post-record phantom) because the signature's
            // clearedTasks count (ct) differs across the two updates.
            if (h.snapshots() !== 1) throw new Error(`expected exactly 1 snapshot, got ${h.snapshots()} (phantom intermediate leak)`);
        } finally {
            mod.clearAllTimeouts();
            mod.setTaskCycleResetDependencies({ recordMultipleClearedTasks: null });
            h.taskList.remove();
        }
    });

    await test('Complete All (cycle mode) marks tasks complete AND captures exactly one snapshot', async () => {
        const h = makeCompleteAllHarness(false);
        h.stateObj.data.cycles.c1.tasks.forEach(t => { t.completed = false; });
        try {
            await mod.handleCompleteAllTasksImpl(() => {}, h.deps);
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

    await test('cycle reset re-arms reminders (startReminders fires in post-reset cleanup)', async () => {
        // Regression guard (Aug 2026 external review #2): the reminder timer
        // stops itself when it fires with zero incomplete tasks (long window in
        // Manual Cycle mode: everything checked, cycle not yet completed), and
        // resetting tasks to incomplete never restarted it — reminders stayed
        // silent for the whole new cycle. Every reset path (auto cycle AND
        // manual Complete via markAllTasksCompleteImpl) funnels through
        // resetTasksImpl's POST_RESET_CLEANUP timeout, so asserting the re-arm
        // there covers both. startReminders is injected module-level (the
        // cleanup timeout reads _deps, not the per-call deps).
        const taskList = document.createElement('ul');
        document.body.appendChild(taskList);
        const stateObj = {
            appState: { activeCycleId: 'c1' },
            metadata: { lastModified: 0 },
            data: { cycles: { c1: { autoReset: true, tasks: [{ id: 'A', completed: true }], recurringTemplates: {} } } },
            settings: {}, userProgress: {}
        };
        let reArmed = 0;
        mod.setTaskCycleResetDependencies({ startReminders: () => { reArmed++; } });
        const deps = {
            AppState: { isReady: () => true, get: () => stateObj, update: async (p) => { p(stateObj); return stateObj; } },
            captureStateSnapshot: () => {},
            isPerformingUndoRedo: () => false,
            querySelector: () => taskList,
            querySelectorAll: () => [],
            checkMiniCycle: () => {},
            incrementCycleCount: () => {}
        };
        try {
            await mod.resetTasksImpl(deps);
            // POST_RESET_CLEANUP is 500ms — wait past it BEFORE clearing timeouts.
            await new Promise(r => setTimeout(r, 700));
            if (reArmed === 0) throw new Error('reset must call startReminders in its cleanup phase (reminders stayed dead for the new cycle)');
        } finally {
            mod.clearAllTimeouts();
            mod.setTaskCycleResetDependencies({ startReminders: null });
            taskList.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Reset counts the tasks it deletes</h4>';

    // resetTasksImpl and deleteCompletedTasksImpl BOTH delete deleteWhenComplete
    // tasks and both archive them, but only the latter advanced
    // userProgress.totalTasksCompleted. In To-Do mode finishing the last task
    // completes the CYCLE and lands here, so the counter never moved and no
    // task-count achievement could unlock — the archive filled while the number
    // behind it stayed at zero.
    function makeResetHarness(tasks) {
        const taskList = document.createElement('ul');
        taskList.id = 'taskList';
        tasks.forEach(t => {
            const li = document.createElement('li');
            li.className = t.recurring ? 'task recurring' : 'task';
            li.dataset.taskId = t.id;
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            li.appendChild(cb);
            taskList.appendChild(li);
        });
        document.body.appendChild(taskList);
        const stateObj = {
            appState: { activeCycleId: 'c1' },
            settings: { disableCompletionAnimation: true },
            data: { cycles: { c1: { tasks: tasks.map(t => ({ ...t, completed: true })), cycleCount: 0 } } },
            userProgress: {}
        };
        const AppState = {
            isReady: () => true,
            get: () => stateObj,
            update: async (producer) => { await producer(stateObj); return stateObj; }
        };
        return { taskList, stateObj, deps: { AppState, querySelector: (sel) => sel === '#taskList' ? taskList : null } };
    }

    await test('reset advances totalTasksCompleted by the tasks it deleted', async () => {
        const h = makeResetHarness([
            { id: 'A', text: 'A', deleteWhenComplete: true },
            { id: 'B', text: 'B', deleteWhenComplete: true },
            { id: 'C', text: 'C', deleteWhenComplete: false }
        ]);
        try {
            await mod.resetTasksImpl(h.deps);
            await new Promise(r => setTimeout(r, 150));
            const got = h.stateObj.userProgress.totalTasksCompleted;
            if (got !== 2) {
                throw new Error(`Expected 2 deleted tasks counted, got ${got}`);
            }
        } finally {
            mod.clearAllTimeouts();
            h.taskList.remove();
        }
    });

    await test('reset does not count recurring occurrences toward the total', async () => {
        // A recurring occurrence is scheduled to return, so counting it would
        // inflate the cleared-task milestones — the same rule the Clear
        // Completed path documents. It still reaches achievements via cycles.
        const h = makeResetHarness([
            { id: 'A', text: 'A', deleteWhenComplete: true },
            { id: 'R', text: 'R', deleteWhenComplete: true, recurring: true }
        ]);
        try {
            await mod.resetTasksImpl(h.deps);
            await new Promise(r => setTimeout(r, 150));
            const got = h.stateObj.userProgress.totalTasksCompleted;
            if (got !== 1) {
                throw new Error(`Recurring occurrence must not count; expected 1, got ${got}`);
            }
        } finally {
            mod.clearAllTimeouts();
            h.taskList.remove();
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
