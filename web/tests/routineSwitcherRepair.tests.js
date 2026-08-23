/**
 * RoutineSwitcher Data Repair Tests
 *
 * `_validateAndRepairCycleData` — the guard that runs before switching into a
 * routine, normalising malformed task and cycle fields so the rest of the app
 * can assume a shape.
 *
 * WRITTEN BEFORE THE EXTRACTION, like the other three switcher suites. This one
 * matters most of the four: repair is SILENT by design. It rewrites the user's
 * stored data and returns a boolean nobody surfaces, so a regression here
 * corrupts routines without any visible failure — no thrown error, no
 * notification, nothing on screen. Nothing tested it before.
 *
 * Covered:
 *   - every field default the repairer applies, individually
 *   - tasks that are not objects are DROPPED, not coerced
 *   - generated task ids carry real entropy (a same-millisecond loop must not
 *     collide — a collision makes drag-reorder silently drop a task)
 *   - a well-formed cycle is left completely alone and reports "no repair"
 *   - repairs are written back through AppState.update, never mutated in place
 *   - a missing cycle reports false rather than throwing
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRoutineSwitcherRepairTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { RoutineSwitcher } = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🩹 RoutineSwitcher Data Repair Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /**
     * An instance whose AppState holds one cycle. `updates` records whether the
     * repair went through a transaction rather than mutating the live object.
     */
    function make(cycle, key = 'c1') {
        const state = { data: { cycles: key ? { [key]: cycle } : {} } };
        const updates = [];
        const instance = new RoutineSwitcher({
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (producer, immediate) => { producer(state); updates.push({ immediate }); }
            }
        });
        return { instance, state, updates, cycleAfter: () => state.data.cycles[key] };
    }

    const WELL_FORMED = () => ({
        title: 'Fine', cycleCount: 2, autoReset: true, deleteCheckedTasks: false,
        tasks: [{
            id: 'task-1', text: 'A', completed: false, highPriority: false,
            remindersEnabled: false, recurring: false, dueDate: null,
            deleteWhenCompleteSettings: { cycle: false, todo: true }
        }]
    });

    // =========================================================
    // 🟢 Leaving good data alone
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🟢 No-op</h4>';

    await test('a well-formed cycle reports no repair and is not rewritten', async () => {
        const { instance, updates } = make(WELL_FORMED());
        const repaired = instance._validateAndRepairCycleData('c1');
        if (repaired !== false) throw new Error('a clean cycle must report false');
        if (updates.length !== 0) throw new Error('a clean cycle must not trigger a state write');
    });

    await test('a missing cycle reports false instead of throwing', async () => {
        const { instance } = make(WELL_FORMED());
        if (instance._validateAndRepairCycleData('nope') !== false) {
            throw new Error('an unknown key must report false');
        }
    });

    // =========================================================
    // 🩹 Task-level repair
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🩹 Tasks</h4>';

    await test('a non-array tasks field becomes an empty array', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: 'not an array' });
        const repaired = instance._validateAndRepairCycleData('c1');
        if (!repaired) throw new Error('should report a repair');
        if (!Array.isArray(cycleAfter().tasks) || cycleAfter().tasks.length !== 0) {
            throw new Error('tasks should be reset to []');
        }
    });

    await test('tasks that are not objects are dropped, not coerced', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [null, 'ghost', 42, { text: 'real' }] });
        instance._validateAndRepairCycleData('c1');
        const tasks = cycleAfter().tasks;
        if (tasks.length !== 1) throw new Error(`expected 1 surviving task, got ${tasks.length}`);
        if (tasks[0].text !== 'real') throw new Error('the wrong task survived');
    });

    await test('a missing task id is generated', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [{ text: 'no id' }] });
        instance._validateAndRepairCycleData('c1');
        const id = cycleAfter().tasks[0].id;
        if (typeof id !== 'string' || !id.startsWith('task-')) throw new Error(`bad id: ${id}`);
    });

    await test('ids generated in the same millisecond do not collide', async () => {
        // The repair loop is synchronous, so every generated id shares a
        // timestamp. Entropy has to come from the random suffix — a collision
        // makes find-by-id resolve two tasks to the first match, and drag-reorder
        // silently drops one.
        const tasks = Array.from({ length: 40 }, () => ({ text: 'x' }));
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks });
        instance._validateAndRepairCycleData('c1');
        const ids = cycleAfter().tasks.map(t => t.id);
        if (new Set(ids).size !== ids.length) {
            throw new Error(`generated ids collided: ${ids.length - new Set(ids).size} duplicate(s)`);
        }
    });

    await test('non-string task text is coerced to a string', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [{ id: 't', text: 123 }] });
        instance._validateAndRepairCycleData('c1');
        if (typeof cycleAfter().tasks[0].text !== 'string') throw new Error('text should be a string');
    });

    await test('missing boolean flags default to false', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [{ id: 't', text: 'x' }] });
        instance._validateAndRepairCycleData('c1');
        const t = cycleAfter().tasks[0];
        for (const f of ['completed', 'highPriority', 'remindersEnabled', 'recurring']) {
            if (typeof t[f] !== 'boolean') throw new Error(`${f} should be boolean, got ${typeof t[f]}`);
        }
    });

    await test('a missing dueDate becomes null, not undefined', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [{ id: 't', text: 'x' }] });
        instance._validateAndRepairCycleData('c1');
        if (cycleAfter().tasks[0].dueDate !== null) throw new Error('dueDate should be null');
    });

    await test('a recurring task without settings gets an object', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [{ id: 't', text: 'x', recurring: true }] });
        instance._validateAndRepairCycleData('c1');
        if (typeof cycleAfter().tasks[0].recurringSettings !== 'object') {
            throw new Error('recurringSettings should be an object');
        }
    });

    await test('deleteWhenCompleteSettings is restored when malformed', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), tasks: [{ id: 't', text: 'x', deleteWhenCompleteSettings: 'nope' }] });
        instance._validateAndRepairCycleData('c1');
        const s = cycleAfter().tasks[0].deleteWhenCompleteSettings;
        if (!s || s.cycle !== false || s.todo !== true) throw new Error(`bad settings: ${JSON.stringify(s)}`);
    });

    // =========================================================
    // 🧱 Cycle-level repair
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧱 Cycle Fields</h4>';

    await test('a missing title falls back to the storage key', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), title: '' });
        instance._validateAndRepairCycleData('c1');
        if (cycleAfter().title !== 'c1') throw new Error(`title was "${cycleAfter().title}"`);
    });

    await test('a negative or non-numeric cycleCount resets to 0', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), cycleCount: -5 });
        instance._validateAndRepairCycleData('c1');
        if (cycleAfter().cycleCount !== 0) throw new Error(`cycleCount was ${cycleAfter().cycleCount}`);
    });

    await test('a non-boolean autoReset defaults to true (auto-cycle mode)', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), autoReset: 'yes' });
        instance._validateAndRepairCycleData('c1');
        if (cycleAfter().autoReset !== true) throw new Error('autoReset should default to true');
    });

    await test('a non-boolean deleteCheckedTasks defaults to false', async () => {
        const { instance, cycleAfter } = make({ ...WELL_FORMED(), deleteCheckedTasks: 1 });
        instance._validateAndRepairCycleData('c1');
        if (cycleAfter().deleteCheckedTasks !== false) throw new Error('should default to false');
    });

    // =========================================================
    // 💾 How repairs are written
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Transaction</h4>';

    await test('repairs go through AppState.update, immediately', async () => {
        const { instance, updates } = make({ ...WELL_FORMED(), title: '' });
        instance._validateAndRepairCycleData('c1');
        if (updates.length !== 1) throw new Error(`expected 1 state write, got ${updates.length}`);
        if (updates[0].immediate !== true) throw new Error('a repair must persist immediately');
    });

    await test('the live state object is not mutated before the transaction', async () => {
        // The repairer clones first — mutating the object returned by
        // AppState.get() would make the undo wrapper snapshot post-change state.
        const cycle = { ...WELL_FORMED(), title: '' };
        const { instance, state } = make(cycle);
        const original = state.data.cycles.c1;
        instance._validateAndRepairCycleData('c1');
        if (original.title !== '') {
            throw new Error('the original object was mutated in place before the update');
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
