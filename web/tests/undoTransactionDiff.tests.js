/**
 * 🧪 UndoTransactionDiff Tests
 * Tests for modules/ui/undoTransactionDiff.js
 * Pattern: Pure Utility (no DI, no state) 🧊
 *
 * `computeTransactionDiff` decides HOW an undo repaints: `requiresFullRender`
 * picks between a targeted update and a full re-render, and the id/field sets
 * drive which rows and panels refresh. Getting a flag wrong does not throw — it
 * leaves the screen disagreeing with state, which is the hardest class of bug to
 * notice and the reason these flags are asserted individually.
 *
 * `describeChange` produces the sentence on the undo notification. Its output
 * comes from getLabel() and is vocabulary-theme sensitive, so every assertion
 * here checks SHAPE (non-empty, distinct, contains an id) rather than exact
 * wording — pinning literals would break the moment a theme is switched.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runUndoTransactionDiffTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { computeTransactionDiff, describeChange } =
        await import(`../modules/ui/undoTransactionDiff.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🧊 UndoTransactionDiff Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const task = (id, over = {}) => ({
        id, text: `Task ${id}`, completed: false, highPriority: false,
        dueDate: null, recurring: false, remindersEnabled: false, ...over
    });
    const snap = (over = {}) => ({
        activeCycleId: 'c1', title: 'Routine', autoReset: false, deleteCheckedTasks: false,
        theme: 'classic', cycleCount: 0, tasks: [task('t1'), task('t2')], ...over
    });

    // =========================================================
    // 🚧 Guards and full-render escalation
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🚧 Full-Render Escalation</h4>';

    await test('a missing snapshot forces a full render', async () => {
        for (const [a, b] of [[null, snap()], [snap(), null], [null, null]]) {
            const d = computeTransactionDiff(a, b);
            if (d.requiresFullRender !== true) {
                throw new Error('a missing snapshot must escalate to a full render');
            }
        }
    });

    await test('a different cycle forces a full render and stops there', async () => {
        const d = computeTransactionDiff(snap(), snap({ activeCycleId: 'c2', tasks: [] }));
        if (!d.cycleChanged) throw new Error('cycleChanged should be set');
        if (!d.requiresFullRender) throw new Error('a cycle change must force a full render');
        // It returns early, so per-task analysis never runs.
        if (d.removedTaskIds.length !== 0) {
            throw new Error('cycle change should short-circuit before per-task diffing');
        }
    });

    await test('routine metadata changes do NOT force a full render', async () => {
        // Deliberate: renaming or switching mode repaints chrome, not every task.
        for (const over of [{ title: 'Renamed' }, { autoReset: true }, { deleteCheckedTasks: true }]) {
            const d = computeTransactionDiff(snap(), snap(over));
            if (!d.cycleChanged) throw new Error(`cycleChanged not set for ${JSON.stringify(over)}`);
            if (d.requiresFullRender) {
                throw new Error(`${JSON.stringify(over)} escalated to a full render unnecessarily`);
            }
        }
    });

    // =========================================================
    // 🎯 Targeted change detection
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Change Detection</h4>';

    await test('an added task is reported as added, not modified', async () => {
        const d = computeTransactionDiff(snap(), snap({ tasks: [task('t1'), task('t2'), task('t3')] }));
        if (!d.addedTaskIds.includes('t3')) throw new Error('t3 not reported as added');
        if (d.changedTaskIds.includes('t3')) throw new Error('a new task must not also count as modified');
        if (!d.taskCountChanged) throw new Error('taskCountChanged should be set');
    });

    await test('a removed task is reported as removed', async () => {
        const d = computeTransactionDiff(snap(), snap({ tasks: [task('t1')] }));
        if (!d.removedTaskIds.includes('t2')) throw new Error('t2 not reported as removed');
        if (!d.taskCountChanged) throw new Error('taskCountChanged should be set');
    });

    await test('reordering the same tasks is an order change, not a content change', async () => {
        const d = computeTransactionDiff(snap(), snap({ tasks: [task('t2'), task('t1')] }));
        if (!d.taskOrderChanged) throw new Error('taskOrderChanged not set — a drag-reorder would not repaint');
        if (d.taskCountChanged) throw new Error('count did not change');
        if (d.addedTaskIds.length || d.removedTaskIds.length) {
            throw new Error('reordering must not look like add/remove');
        }
    });

    await test('each per-task field is detected individually', async () => {
        const cases = {
            text:             { text: 'edited' },
            completed:        { completed: true },
            highPriority:     { highPriority: true },
            priorityColor:    { priorityColor: '#dc3545' },
            dueDate:          { dueDate: '2026-01-01' },
            recurring:        { recurring: true },
            remindersEnabled: { remindersEnabled: true }
        };
        const missed = [];
        for (const [field, over] of Object.entries(cases)) {
            const d = computeTransactionDiff(snap(), snap({ tasks: [task('t1', over), task('t2')] }));
            if (!d.changedTaskIds.includes('t1') || !d.fieldsChanged.includes(field)) missed.push(field);
        }
        if (missed.length) throw new Error(`fields not detected: ${missed.join(', ')}`);
    });

    await test('fieldsChanged is delivered as an ARRAY, not the Set it starts as', async () => {
        // Easy to get wrong from reading the source: the diff object literal
        // initialises `fieldsChanged: new Set()`, and only the final line before
        // the return spreads it into an array. Callers doing `.has(...)` would
        // throw; this pins the shape callers actually receive.
        const d = computeTransactionDiff(snap(), snap({ tasks: [task('t1', { completed: true }), task('t2')] }));
        if (!Array.isArray(d.fieldsChanged)) {
            throw new Error(`fieldsChanged is ${d.fieldsChanged?.constructor?.name}, expected Array`);
        }
        if (!d.fieldsChanged.includes('completed')) throw new Error('expected "completed" in fieldsChanged');
    });

    await test('an identical snapshot pair reports no changes at all', async () => {
        const d = computeTransactionDiff(snap(), snap());
        const flags = ['cycleChanged', 'themeChanged', 'recurringChanged', 'clearedTasksChanged',
                       'taskCountChanged', 'taskOrderChanged', 'requiresFullRender'];
        const set = flags.filter(f => d[f]);
        if (set.length) throw new Error(`unchanged snapshots reported: ${set.join(', ')}`);
        if (d.changedTaskIds.length) throw new Error('reported modified tasks with no change');
    });

    await test('theme, recurring templates and cleared tasks each raise their own flag', async () => {
        const t = computeTransactionDiff(snap(), snap({ theme: 'fitness' }));
        if (!t.themeChanged) throw new Error('themeChanged not set');

        const r = computeTransactionDiff(
            snap({ recurringTemplates: {} }),
            snap({ recurringTemplates: { t1: { recurringSettings: { frequency: 'daily' } } } })
        );
        if (!r.recurringChanged) throw new Error('recurringChanged not set');

        const c = computeTransactionDiff(
            snap({ clearedTasks: { totalCleared: 0, entries: [] } }),
            snap({ clearedTasks: { totalCleared: 2, entries: [] } })
        );
        if (!c.clearedTasksChanged) throw new Error('clearedTasksChanged not set');
    });

    // =========================================================
    // 💬 describeChange
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">💬 describeChange</h4>';

    await test('a missing snapshot still yields a description', async () => {
        // The undo notification always shows something; an empty string would
        // render as a blank toast.
        for (const [a, b] of [[null, snap()], [snap(), null]]) {
            const out = describeChange(a, b);
            if (typeof out !== 'string' || out.trim() === '') {
                throw new Error('expected a non-empty fallback description');
            }
        }
    });

    await test('different kinds of change produce different descriptions', async () => {
        // Theme-sensitive wording, so compare descriptions to EACH OTHER rather
        // than to literals.
        const seen = new Map([
            ['rename',    describeChange(snap(), snap({ title: 'Renamed' }))],
            ['add',       describeChange(snap(), snap({ tasks: [task('t1'), task('t2'), task('t3')] }))],
            ['delete',    describeChange(snap(), snap({ tasks: [task('t1')] }))],
            ['complete',  describeChange(snap(), snap({ tasks: [task('t1', { completed: true }), task('t2')] }))]
        ]);
        for (const [k, v] of seen) {
            if (typeof v !== 'string' || v.trim() === '') throw new Error(`${k} produced no description`);
        }
        const values = [...seen.values()];
        if (new Set(values).size !== values.length) {
            throw new Error(`distinct changes shared a description: ${JSON.stringify(values)}`);
        }
    });

    await test('the diff carries the same description describeChange returns', async () => {
        const from = snap(), to = snap({ title: 'Renamed' });
        if (computeTransactionDiff(from, to).description !== describeChange(from, to)) {
            throw new Error('computeTransactionDiff.description drifted from describeChange');
        }
    });

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
