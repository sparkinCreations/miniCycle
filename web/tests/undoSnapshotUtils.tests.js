/**
 * 🧪 UndoSnapshotUtils Tests
 * Tests for modules/ui/undoSnapshotUtils.js
 * Pattern: Pure Utility (no DI, no state) 🧊
 *
 * These five functions were extracted from undoRedoManager.js (Priority 3,
 * LARGE_MODULE_SPLITS_PLAN.md). They are pure, so they need no mock deps and no
 * setup — which is exactly what made them the right cluster to move.
 *
 * `sanitizeSnapshot` had ZERO test references before this file: 40 lines that
 * run on every undo and every redo, deciding what is allowed back into state.
 * It is the reason this suite exists.
 *
 * Covered:
 *   - validateSnapshot: every rejection branch, individually
 *   - sanitizeSnapshot: each clamp/normalise rule, plus its in-place contract
 *   - filterValidSnapshots: guards, filtering, and input immutability
 *   - buildSnapshotSignature: fields that MUST change the signature (each one is
 *     a dedup bug if omitted — two are recorded in the source comments)
 *   - snapshotsEqual: the cached-_sig fast path, including when it lies
 */
import { createProtectedTest } from './testHelpers.js';

export async function runUndoSnapshotUtilsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const {
        validateSnapshot,
        sanitizeSnapshot,
        filterValidSnapshots,
        buildSnapshotSignature,
        snapshotsEqual
    } = await import(`../modules/ui/undoSnapshotUtils.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🧊 UndoSnapshotUtils Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const snap = (over = {}) => ({
        activeCycleId: 'c1',
        tasks: [{ id: 't1', text: 'Task one', completed: false }],
        title: 'c1',
        autoReset: true,
        deleteCheckedTasks: false,
        cycleCount: 3,
        theme: 'classic',
        ...over
    });

    // =========================================================
    // ✅ validateSnapshot
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ validateSnapshot</h4>';

    await test('rejects null and non-objects', async () => {
        for (const bad of [null, undefined, 'snapshot', 42, []]) {
            if (validateSnapshot(bad, 'c1') !== false) {
                throw new Error(`accepted ${JSON.stringify(bad)}`);
            }
        }
    });

    await test('rejects a snapshot with no activeCycleId', async () => {
        if (validateSnapshot({ tasks: [] }, 'c1') !== false) throw new Error('should reject');
    });

    await test('rejects a snapshot belonging to a different cycle', async () => {
        // This is the check that makes a verbatim rename wipe history: every
        // migrated snapshot still carries the OLD id and fails here.
        if (validateSnapshot(snap({ activeCycleId: 'other' }), 'c1') !== false) {
            throw new Error('cross-cycle snapshot was accepted');
        }
    });

    await test('rejects a snapshot whose tasks are not an array', async () => {
        if (validateSnapshot(snap({ tasks: 'nope' }), 'c1') !== false) throw new Error('should reject');
    });

    await test('accepts a well-formed snapshot', async () => {
        if (validateSnapshot(snap(), 'c1') !== true) throw new Error('valid snapshot was rejected');
    });

    // =========================================================
    // 🧼 sanitizeSnapshot — previously untested
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧼 sanitizeSnapshot</h4>';

    await test('returns non-objects unchanged rather than throwing', async () => {
        if (sanitizeSnapshot(null) !== null) throw new Error('null should pass through');
        if (sanitizeSnapshot('x') !== 'x') throw new Error('string should pass through');
    });

    await test('clamps a negative cycleCount to 0', async () => {
        if (sanitizeSnapshot(snap({ cycleCount: -7 })).cycleCount !== 0) throw new Error('not clamped');
    });

    await test('floors a fractional cycleCount', async () => {
        if (sanitizeSnapshot(snap({ cycleCount: 4.9 })).cycleCount !== 4) throw new Error('not floored');
    });

    await test('replaces a non-finite cycleCount with 0', async () => {
        for (const bad of [NaN, Infinity, 'many', null]) {
            const out = sanitizeSnapshot(snap({ cycleCount: bad })).cycleCount;
            if (out !== 0) throw new Error(`cycleCount ${String(bad)} became ${out}, expected 0`);
        }
    });

    await test('rewrites an unknown theme to classic', async () => {
        if (sanitizeSnapshot(snap({ theme: 'not-a-theme' })).theme !== 'classic') {
            throw new Error('unknown theme survived');
        }
    });

    await test('leaves a known theme alone', async () => {
        for (const t of ['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning']) {
            const out = sanitizeSnapshot(snap({ theme: t })).theme;
            if (out !== t) throw new Error(`known theme ${t} was rewritten to ${out}`);
        }
    });

    await test('clamps clearedTasks.totalCleared and repairs its entries array', async () => {
        const out = sanitizeSnapshot(snap({ clearedTasks: { totalCleared: -3, entries: 'nope' } }));
        if (out.clearedTasks.totalCleared !== 0) throw new Error('totalCleared not clamped');
        if (!Array.isArray(out.clearedTasks.entries)) throw new Error('entries not repaired to an array');
    });

    await test('drops malformed tasks and keeps well-formed ones', async () => {
        const out = sanitizeSnapshot(snap({
            tasks: [
                null,
                'ghost',
                { id: 't1', text: 'keep me', completed: false },
                { id: 5, text: 'numeric id' },
                { id: 't2' },                       // no text
                { text: 'no id' }
            ]
        }));
        if (out.tasks.length !== 1) throw new Error(`expected 1 surviving task, got ${out.tasks.length}`);
        if (out.tasks[0].text !== 'keep me') throw new Error('the wrong task survived');
    });

    await test('mutates the snapshot in place, as documented', async () => {
        // The JSDoc promises in-place mutation "for efficiency", and callers rely
        // on it: performStateBasedUndo/Redo sanitise and then use the SAME object.
        // Switching to a copy would silently restore unsanitised data.
        const input = snap({ cycleCount: -1 });
        const output = sanitizeSnapshot(input);
        if (output !== input) throw new Error('returned a different object than it was given');
        if (input.cycleCount !== 0) throw new Error('the original object was not mutated');
    });

    // =========================================================
    // 🧹 filterValidSnapshots
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 filterValidSnapshots</h4>';

    await test('returns an empty array for non-array input', async () => {
        for (const bad of [null, undefined, 'x', {}]) {
            const out = filterValidSnapshots(bad, 'c1');
            if (!Array.isArray(out) || out.length !== 0) throw new Error(`bad result for ${String(bad)}`);
        }
    });

    await test('returns empty when no cycleId is supplied', async () => {
        const out = filterValidSnapshots([snap()], null);
        if (out.length !== 0) throw new Error('missing cycleId should yield nothing');
    });

    await test('keeps only the snapshots belonging to the cycle', async () => {
        const out = filterValidSnapshots(
            [snap(), snap({ activeCycleId: 'other' }), snap({ tasks: null }), snap()],
            'c1'
        );
        if (out.length !== 2) throw new Error(`expected 2 survivors, got ${out.length}`);
    });

    await test('does not mutate the array it was given', async () => {
        const input = [snap(), snap({ activeCycleId: 'other' })];
        filterValidSnapshots(input, 'c1');
        if (input.length !== 2) throw new Error('input array was mutated');
    });

    // =========================================================
    // 🔑 buildSnapshotSignature
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔑 buildSnapshotSignature</h4>';

    await test('returns an empty string for a missing snapshot', async () => {
        if (buildSnapshotSignature(null) !== '') throw new Error('expected empty string');
    });

    await test('identical content produces an identical signature', async () => {
        if (buildSnapshotSignature(snap()) !== buildSnapshotSignature(snap())) {
            throw new Error('same content produced different signatures');
        }
    });

    await test('every field that a user can change alters the signature', async () => {
        // Each miss here is a real dedup bug: the snapshot never gets pushed and
        // the edit falls outside undo history. Two of these (recurringSettings
        // and taskViewLayout) are recorded in the source as exactly that.
        const base = buildSnapshotSignature(snap());
        const variants = {
            'task text':          snap({ tasks: [{ id: 't1', text: 'changed', completed: false }] }),
            'completed flag':     snap({ tasks: [{ id: 't1', text: 'Task one', completed: true }] }),
            'high priority':      snap({ tasks: [{ id: 't1', text: 'Task one', highPriority: true }] }),
            'recurringSettings':  snap({ tasks: [{ id: 't1', text: 'Task one', recurringSettings: { frequency: 'daily' } }] }),
            'title':              snap({ title: 'renamed' }),
            'autoReset':          snap({ autoReset: false }),
            'deleteCheckedTasks': snap({ deleteCheckedTasks: true }),
            'cycleCount':         snap({ cycleCount: 99 }),
            'theme':              snap({ theme: 'fitness' }),
            'taskViewLayout':     snap({ taskViewLayout: { positions: { t1: { x: 10, y: 20 } } } })
        };
        const missed = Object.entries(variants)
            .filter(([, v]) => buildSnapshotSignature(v) === base)
            .map(([k]) => k);
        if (missed.length) throw new Error(`signature ignores: ${missed.join(', ')}`);
    });

    await test('task ORDER changes the signature', async () => {
        const a = snap({ tasks: [{ id: 't1', text: 'one' }, { id: 't2', text: 'two' }] });
        const b = snap({ tasks: [{ id: 't2', text: 'two' }, { id: 't1', text: 'one' }] });
        if (buildSnapshotSignature(a) === buildSnapshotSignature(b)) {
            throw new Error('reordering tasks left the signature unchanged, so a drag-reorder would not be undoable');
        }
    });

    // =========================================================
    // ⚖️ snapshotsEqual
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚖️ snapshotsEqual</h4>';

    await test('a missing side is never equal', async () => {
        if (snapshotsEqual(null, null) !== false) throw new Error('null/null should be false');
        if (snapshotsEqual(snap(), null) !== false) throw new Error('one-sided should be false');
    });

    await test('identical snapshots compare equal without cached signatures', async () => {
        if (snapshotsEqual(snap(), snap()) !== true) throw new Error('identical should be equal');
    });

    await test('differing snapshots compare unequal', async () => {
        if (snapshotsEqual(snap(), snap({ title: 'different' })) !== false) {
            throw new Error('different snapshots compared equal');
        }
    });

    await test('a cached _sig is trusted over the content, so a stale one lies', async () => {
        // Documented fast path: when BOTH sides carry _sig it short-circuits on
        // them. That is why the IndexedDB rename deletes _sig when relabelling —
        // a signature carrying the old cycle id would otherwise make the first
        // post-rename capture compare equal and never push.
        const a = { ...snap(), _sig: 'same' };
        const b = { ...snap({ title: 'totally different' }), _sig: 'same' };
        if (snapshotsEqual(a, b) !== true) {
            throw new Error('cached-signature fast path is not being used');
        }
        const c = { ...snap(), _sig: 'x' };
        const d = { ...snap(), _sig: 'y' };
        if (snapshotsEqual(c, d) !== false) {
            throw new Error('differing cached signatures should compare unequal');
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
