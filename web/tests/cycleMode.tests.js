/**
 * CycleMode Tests
 * Tests for modules/utils/cycleMode.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/cycleMode.js?v=${cacheBuster}`);
    const { getCycleMode, getAllDoneHintKey, getTaskResetIndicator,
            getRoutines, getActiveRoutineId, getRoutine, getActiveRoutine, setActiveRoutineId,
            routineHasTasks, areAllTasksComplete,
            getAutoClearMode, syncTaskAutoClear, resolveAutoClear, getAutoClear, setAutoClear,
            getAutoClearForMode, getAutoClearSettings, isAutoClearSettings, setAutoClearSettings,
            autoClearFields } = mod;
    const { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS: DEFAULTS } =
        await import(`../modules/core/constants.js?v=${cacheBuster}`);
    const { DEFAULT_LABELS } = await import(`../modules/labels/defaultLabels.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>CycleMode Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('exports getCycleMode and getAllDoneHintKey as functions', () => {
        if (typeof getCycleMode !== 'function') throw new Error(`getCycleMode: ${typeof getCycleMode}`);
        if (typeof getAllDoneHintKey !== 'function') throw new Error(`getAllDoneHintKey: ${typeof getAllDoneHintKey}`);
    });

    // ── getCycleMode ─────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 getCycleMode</h4>';

    await test('neither flag set is manual', () => {
        if (getCycleMode({}) !== 'manual') throw new Error(getCycleMode({}));
        if (getCycleMode({ autoReset: false, deleteCheckedTasks: false }) !== 'manual') {
            throw new Error('explicit false flags should still be manual');
        }
    });

    await test('autoReset is auto', () => {
        if (getCycleMode({ autoReset: true }) !== 'auto') throw new Error(getCycleMode({ autoReset: true }));
    });

    await test('deleteCheckedTasks is todo', () => {
        if (getCycleMode({ deleteCheckedTasks: true }) !== 'todo') {
            throw new Error(getCycleMode({ deleteCheckedTasks: true }));
        }
    });

    await test('deleteCheckedTasks wins when both flags are set', () => {
        // A To-Do routine DELETES finished tasks; there is nothing left to reset,
        // so the todo reading has to take precedence.
        if (getCycleMode({ autoReset: true, deleteCheckedTasks: true }) !== 'todo') {
            throw new Error('todo must win over auto');
        }
    });

    await test('missing cycle falls back to manual rather than throwing', () => {
        for (const bad of [null, undefined]) {
            if (getCycleMode(bad) !== 'manual') throw new Error(`Expected manual for ${bad}`);
        }
    });

    // ── getAllDoneHintKey ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✅ getAllDoneHintKey</h4>';

    await test('auto-cycle does NOT name a button', () => {
        // The regression this module exists for: auto-cycle hides the
        // complete/cycle button in BOTH surfaces (taskUI.checkCompleteAllButton
        // skips it, focusMode hides the floating button via CSS), so the old
        // binary branch pointed users at a control that is not on screen.
        const key = getAllDoneHintKey({ autoReset: true });
        if (key === 'focusTask.allDoneHintCycle') {
            throw new Error('auto-cycle must not be told to press the cycle button');
        }
        if (key !== 'focusTask.allDoneHintAuto') throw new Error(`Unexpected key: ${key}`);
        const text = DEFAULT_LABELS.focusTask.allDoneHintAuto;
        if (/button/i.test(text)) {
            throw new Error(`auto hint must not mention a button, got: "${text}"`);
        }
    });

    await test('manual cycle names the cycle button', () => {
        if (getAllDoneHintKey({}) !== 'focusTask.allDoneHintCycle') {
            throw new Error(getAllDoneHintKey({}));
        }
    });

    await test('to-do mode names the clear button', () => {
        if (getAllDoneHintKey({ deleteCheckedTasks: true }) !== 'focusTask.allDoneHintTodo') {
            throw new Error(getAllDoneHintKey({ deleteCheckedTasks: true }));
        }
    });

    await test('every mode maps to a label key that actually exists', () => {
        // A typo'd key would silently render the key string to the user.
        for (const cycle of [{}, { autoReset: true }, { deleteCheckedTasks: true }]) {
            const key = getAllDoneHintKey(cycle);
            const value = key.split('.').reduce((o, k) => o?.[k], DEFAULT_LABELS);
            if (typeof value !== 'string' || !value) {
                throw new Error(`${key} does not resolve to a label`);
            }
        }
    });

    // ── getAutoClearMode ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗝️ getAutoClearMode</h4>';

    await test('autoClear is keyed by two modes, not three', () => {
        // auto and manual routines both RESET rather than delete, so both read
        // the `cycle` key — the three-way getCycleMode must not leak through.
        if (getAutoClearMode({ deleteCheckedTasks: true }) !== 'todo') throw new Error('todo');
        if (getAutoClearMode({ autoReset: true }) !== 'cycle') throw new Error('auto should map to cycle');
        if (getAutoClearMode({}) !== 'cycle') throw new Error('manual should map to cycle');
        if (getAutoClearMode(null) !== 'cycle') throw new Error('null should map to cycle');
    });

    // ── syncTaskAutoClear ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 syncTaskAutoClear</h4>';

    await test('repairs PER KEY — the other mode\'s valid value survives', () => {
        // The regression this helper exists to kill: whole-object replacement turned
        // {cycle:true, todo:<bad>} into {cycle:false, todo:true}, silently discarding
        // the user's Cycle setting on load.
        const task = { autoClear: { cycle: true, todo: 'nope' } };
        const result = syncTaskAutoClear(task, 'todo', DEFAULTS);
        if (task.autoClear.cycle !== true) throw new Error('the valid cycle value was discarded during repair');
        if (task.autoClear.todo !== DEFAULTS.todo) throw new Error('bad key not defaulted');
        if (!result.repaired) throw new Error('should report repaired');
    });

    await test('rebuilds a missing map from defaults', () => {
        const task = {};
        const result = syncTaskAutoClear(task, 'cycle', DEFAULTS);
        if (task.autoClear.cycle !== DEFAULTS.cycle) throw new Error('cycle default');
        if (task.autoClear.todo !== DEFAULTS.todo) throw new Error('todo default');
        if (!result.repaired || !result.changed) throw new Error('should report repaired + changed');
    });

    await test('rebuilds a non-object map', () => {
        for (const bad of ['x', 42, true, null]) {
            const task = { autoClear: bad };
            syncTaskAutoClear(task, 'cycle', DEFAULTS);
            if (typeof task.autoClear !== 'object') throw new Error(`not repaired for ${bad}`);
            if (task.autoClear.todo !== DEFAULTS.todo) throw new Error(`bad rebuild for ${bad}`);
        }
    });

    await test('is idempotent — a clean task reports no change', () => {
        // modeManager documents "callers that only touched autoReset pay no cost",
        // and routineLoader drives its tasksModified flag off this.
        const task = { autoClear: { cycle: false, todo: true } };
        const before = task.autoClear;
        const result = syncTaskAutoClear(task, 'cycle', DEFAULTS);
        if (result.changed || result.repaired) throw new Error('clean task should report no change');
        if (task.autoClear !== before) throw new Error('a clean map must not be replaced');
    });

    await test('keeps an unknown boolean mode — the map is OPEN', () => {
        // A mode a newer build adds must survive a round trip through this one
        // (SCHEMA_2_6_PLAN.md, "Built to adapt").
        const task = { autoClear: { cycle: true, todo: true, someday: false } };
        const result = syncTaskAutoClear(task, 'cycle', DEFAULTS);
        if (task.autoClear.someday !== false) throw new Error('unknown mode dropped');
        if (result.repaired) throw new Error('a valid open map is not a repair');
    });

    await test('drops non-boolean junk under an unknown key', () => {
        const task = { autoClear: { cycle: true, todo: true, bogus: 'x' } };
        const result = syncTaskAutoClear(task, 'cycle', DEFAULTS);
        if ('bogus' in task.autoClear) throw new Error('junk survived');
        if (!result.repaired) throw new Error('dropping junk is a rebuild — should report repaired');
    });

    await test('covers every key in the defaults map, not a hardcoded pair', () => {
        const task = {};
        syncTaskAutoClear(task, 'cycle', { cycle: false, todo: true, someday: true });
        if (task.autoClear.someday !== true) throw new Error('extra default mode not carried');
    });

    await test('never writes the retired 2.5 mirror', () => {
        const task = { autoClear: { cycle: 'bad', todo: true } };
        syncTaskAutoClear(task, 'cycle', DEFAULTS);
        if ('deleteWhenComplete' in task || 'deleteWhenCompleteSettings' in task) {
            throw new Error('a 2.5 field was written');
        }
    });

    await test('returns safely for a null task or missing defaults', () => {
        const a = syncTaskAutoClear(null, 'cycle', DEFAULTS);
        if (a.changed || a.repaired) throw new Error('null task should be inert');
        const b = syncTaskAutoClear({}, 'cycle', null);
        if (b.changed || b.repaired) throw new Error('missing defaults should be inert');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">resolveAutoClear — per key, then the default</h4>';

    const resolve = (settings, mode) => resolveAutoClear({ settings, mode, defaults: DEFAULTS });

    await test('honours a PARTIALLY populated map for the mode it covers', () => {
        // Per key, not wholesale — the same rule syncTaskAutoClear follows.
        if (resolve({ cycle: true }, 'cycle') !== true) throw new Error('a valid key for the active mode must win');
        // ...and must NOT be borrowed for the mode it does not cover.
        if (resolve({ cycle: true }, 'todo') !== DEFAULTS.todo) throw new Error('a key for the other mode must not leak across modes');
    });

    await test('falls back to the per-mode default when the map is missing or malformed', () => {
        if (resolve(undefined, 'cycle') !== DEFAULTS.cycle) throw new Error('cycle with no map');
        if (resolve(undefined, 'todo') !== DEFAULTS.todo) throw new Error('todo with no map');
        if (resolve({ cycle: 'yes', todo: 1 }, 'cycle') !== DEFAULTS.cycle) throw new Error('non-boolean key should default');
    });

    await test('a 2.5 mirror passed as `legacy` is ignored — the map is the only source', () => {
        if (resolveAutoClear({ settings: undefined, legacy: true, mode: 'cycle', defaults: DEFAULTS }) !== DEFAULTS.cycle) {
            throw new Error('the retired mirror must not be consulted');
        }
    });

    await test('getTaskResetIndicator matches the routine list branch table', () => {
        const cases = [
            [{ autoClear: true,  isRecurring: false, mode: 'todo'  }, null],
            [{ autoClear: false, isRecurring: false, mode: 'todo'  }, 'keep'],
            [{ autoClear: false, isRecurring: false, mode: 'cycle' }, null],
            [{ autoClear: true,  isRecurring: false, mode: 'cycle' }, 'clear'],
            [{ autoClear: true,  isRecurring: true,  mode: 'cycle' }, null],
            [{ autoClear: false, isRecurring: true,  mode: 'cycle' }, 'keep']
        ];
        for (const [args, want] of cases) {
            const got = getTaskResetIndicator(args);
            if (got !== want) throw new Error(`${JSON.stringify(args)} -> ${got}, expected ${want}`);
        }
    });

    // ── Routine accessors ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗂️ Routine accessors (data.routine / activeRoutineId)</h4>';

    const makeState = () => ({
        data: { routine: {
            r1: { title: 'Morning', cycleCount: 3, tasks: [{ id: 't1' }] },
            r2: { title: 'Evening', cycleCount: 0, tasks: [] }
        } },
        appState: { activeRoutineId: 'r1' }
    });

    await test('getRoutines and getActiveRoutineId read the stored keys', () => {
        const state = makeState();
        if (getRoutines(state) !== state.data.routine) throw new Error('getRoutines should return data.routine');
        if (getActiveRoutineId(state) !== 'r1') throw new Error(`getActiveRoutineId: ${getActiveRoutineId(state)}`);
    });

    await test('the 2.5 keys are no longer read', () => {
        // A document that missed the migration must look EMPTY here, not half-work.
        const stale = { data: { cycles: { r1: { title: 'x', tasks: [] } } }, appState: { activeCycleId: 'r1' } };
        if (getRoutines(stale) !== null) throw new Error('data.cycles was read');
        if (getActiveRoutineId(stale) !== null) throw new Error('activeCycleId was read');
    });

    await test('getActiveRoutine returns the open routine itself, so producer edits land in state', () => {
        const state = makeState();
        const routine = getActiveRoutine(state);
        if (routine !== state.data.routine.r1) throw new Error('should return the stored routine object, not a copy');
        routine.cycleCount += 1;
        if (state.data.routine.r1.cycleCount !== 4) throw new Error('an edit through the helper did not reach state');
    });

    await test('getRoutine finds a routine by id and returns null for an unknown id', () => {
        const state = makeState();
        if (getRoutine(state, 'r2')?.title !== 'Evening') throw new Error('r2 not found');
        if (getRoutine(state, 'missing') !== null) throw new Error('unknown id should be null');
        if (getRoutine(state, null) !== null || getRoutine(state, '') !== null) throw new Error('empty id should be null');
    });

    await test('getRoutine ignores inherited names like constructor and toString', () => {
        const state = makeState();
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            if (getRoutine(state, name) !== null) throw new Error(`"${name}" was treated as a routine`);
        }
    });

    await test('routine accessors return null instead of throwing when data is missing', () => {
        for (const bad of [null, undefined, {}, { data: {} }, { appState: {} }]) {
            if (getRoutines(bad) !== null) throw new Error(`getRoutines for ${JSON.stringify(bad)}`);
            if (getActiveRoutineId(bad) !== null) throw new Error(`getActiveRoutineId for ${JSON.stringify(bad)}`);
            if (getActiveRoutine(bad) !== null) throw new Error(`getActiveRoutine for ${JSON.stringify(bad)}`);
        }
        const pointingNowhere = makeState();
        pointingNowhere.appState.activeRoutineId = 'gone';
        if (getActiveRoutine(pointingNowhere) !== null) throw new Error('an id with no routine should be null');
    });

    await test('setActiveRoutineId writes activeRoutineId and creates appState if needed', () => {
        const state = makeState();
        setActiveRoutineId(state, 'r2');
        if (state.appState.activeRoutineId !== 'r2') throw new Error('activeRoutineId not written');
        if (getActiveRoutine(state)?.title !== 'Evening') throw new Error('helper did not follow the new id');

        const bare = { data: { routine: {} } };
        setActiveRoutineId(bare, 'r9');
        if (bare.appState?.activeRoutineId !== 'r9') throw new Error('appState should be created');

        setActiveRoutineId(null, 'r1'); // must not throw
    });

    await test('routine accessors never write the 2.5 names', () => {
        const state = makeState();
        getActiveRoutine(state);
        setActiveRoutineId(state, 'r2');
        const saved = JSON.stringify(state);
        for (const oldName of ['cycles', 'activeCycleId']) {
            if (saved.includes(`"${oldName}"`)) throw new Error(`stored data gained a "${oldName}" key`);
        }
    });

    // ── Completion helpers ───────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✅ routineHasTasks / areAllTasksComplete</h4>';

    await test('routineHasTasks is true only for a routine with at least one task', () => {
        if (routineHasTasks({ tasks: [{ id: 'a' }] }) !== true) throw new Error('one task');
        if (routineHasTasks({ tasks: [] }) !== false) throw new Error('empty');
        for (const bad of [null, undefined, {}, { tasks: null }, { tasks: 'x' }]) {
            if (routineHasTasks(bad) !== false) throw new Error(`should be false for ${JSON.stringify(bad)}`);
        }
    });

    await test('areAllTasksComplete requires every task complete, and at least one task', () => {
        if (areAllTasksComplete({ tasks: [{ completed: true }, { completed: true }] }) !== true) throw new Error('all done');
        if (areAllTasksComplete({ tasks: [{ completed: true }, { completed: false }] }) !== false) throw new Error('one open');
        if (areAllTasksComplete({ tasks: [] }) !== false) throw new Error('empty routine must not count as complete');
        if (areAllTasksComplete(null) !== false) throw new Error('null');
    });

    await test('areAllTasksComplete treats a missing or non-boolean completed as not complete', () => {
        if (areAllTasksComplete({ tasks: [{ completed: true }, {}] }) !== false) throw new Error('missing flag');
        if (areAllTasksComplete({ tasks: [{ completed: 'yes' }] }) !== false) throw new Error('string flag');
        if (areAllTasksComplete({ tasks: [{ completed: true }, null] }) !== false) throw new Error('null task');
    });

    // ── autoClear accessors ──────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 autoClear accessors (Clear on Reset / Marked for Clearing)</h4>';

    const cycleRoutine = { autoReset: true };
    const todoRoutine = { deleteCheckedTasks: true };

    await test('getAutoClear answers for the routine\'s current mode', () => {
        const task = { autoClear: { cycle: true, todo: false } };
        if (getAutoClear(task, cycleRoutine, DEFAULTS) !== true) throw new Error('Clear on Reset (cycle) should be on');
        if (getAutoClear(task, todoRoutine, DEFAULTS) !== false) throw new Error('Marked for Clearing (todo) should be off');
    });

    await test('getAutoClear falls back to the mode default, and ignores the retired 2.5 fields', () => {
        if (getAutoClear({}, todoRoutine, DEFAULTS) !== DEFAULTS.todo) throw new Error('todo default');
        if (getAutoClear({}, cycleRoutine, DEFAULTS) !== DEFAULTS.cycle) throw new Error('cycle default');
        const stale = { deleteWhenComplete: true, deleteWhenCompleteSettings: { cycle: true, todo: true } };
        if (getAutoClear(stale, cycleRoutine, DEFAULTS) !== DEFAULTS.cycle) throw new Error('2.5 fields must not be read');
    });

    await test('setAutoClear makes the same write as the task toggle and keeps the other mode', () => {
        const task = { autoClear: { cycle: false, todo: false } };
        const written = setAutoClear(task, cycleRoutine, true, DEFAULTS);
        if (written !== 'cycle') throw new Error(`wrote mode ${written}`);
        if (task.autoClear.cycle !== true) throw new Error('per-mode setting not written');
        if (task.autoClear.todo !== false) throw new Error('the To-Do setting was changed');

        setAutoClear(task, todoRoutine, true, DEFAULTS);
        if (task.autoClear.cycle !== true) throw new Error('turning on To-Do lost the Cycle setting');
        if (getAutoClear(task, todoRoutine, DEFAULTS) !== true) throw new Error('round trip in To-Do mode');
        if (getAutoClear(task, cycleRoutine, DEFAULTS) !== true) throw new Error('round trip in Cycle mode');
    });

    await test('setAutoClear repairs a missing or invalid map before writing', () => {
        const task = { autoClear: 'garbage' };
        setAutoClear(task, cycleRoutine, true, DEFAULTS);
        if (task.autoClear.cycle !== true) throw new Error('value not written after repair');
        if (task.autoClear.todo !== DEFAULTS.todo) throw new Error('other mode not defaulted');
    });

    await test('setAutoClear never modifies the frozen defaults object', () => {
        const task = { autoClear: DEFAULTS };
        const before = JSON.stringify(DEFAULTS);
        setAutoClear(task, cycleRoutine, !DEFAULTS.cycle, DEFAULTS);
        if (JSON.stringify(DEFAULTS) !== before) throw new Error('the shared defaults object was changed');
        if (task.autoClear === DEFAULTS) throw new Error('task should get its own map object');
        if (task.autoClear.cycle !== !DEFAULTS.cycle) throw new Error('value not written');
    });

    await test('setAutoClear writes autoClear and nothing else', () => {
        const task = { id: 't1' };
        setAutoClear(task, todoRoutine, false, DEFAULTS);
        const keys = Object.keys(task).sort().join(',');
        if (keys !== 'autoClear,id') throw new Error(`unexpected keys: ${keys}`);
    });

    await test('setAutoClear is inert for a missing task or missing defaults', () => {
        if (setAutoClear(null, cycleRoutine, true, DEFAULTS) !== null) throw new Error('null task');
        const task = {};
        if (setAutoClear(task, cycleRoutine, true, null) !== null) throw new Error('missing defaults');
        if ('autoClear' in task) throw new Error('task was written without defaults');
    });

    // ── map-level helpers ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 autoClear map helpers</h4>';

    await test('getAutoClearForMode reads the given mode, not the routine', () => {
        const task = { autoClear: { cycle: true, todo: false } };
        if (getAutoClearForMode(task, 'cycle', DEFAULTS) !== true) throw new Error('cycle key ignored');
        if (getAutoClearForMode(task, 'todo', DEFAULTS) !== false) throw new Error('todo key ignored');
        if (getAutoClear(task, cycleRoutine, DEFAULTS) !== getAutoClearForMode(task, 'cycle', DEFAULTS)) {
            throw new Error('getAutoClear must agree with the mode-keyed read');
        }
    });

    await test('getAutoClearForMode falls back to the default for a missing map or task', () => {
        if (getAutoClearForMode({}, 'todo', DEFAULTS) !== DEFAULTS.todo) throw new Error('default ignored');
        if (getAutoClearForMode(null, 'cycle', DEFAULTS) !== DEFAULTS.cycle) throw new Error('null task should read the default');
    });

    await test('getAutoClearSettings returns the stored map or undefined', () => {
        const map = { cycle: true, todo: true };
        if (getAutoClearSettings({ autoClear: map }) !== map) throw new Error('should return the stored object itself');
        if (getAutoClearSettings({}) !== undefined) throw new Error('missing map should be undefined');
        if (getAutoClearSettings({ autoClear: null }) !== undefined) throw new Error('null map should be undefined');
        if (getAutoClearSettings(null) !== undefined) throw new Error('null task should be undefined');
    });

    await test('isAutoClearSettings requires a boolean for every default key', () => {
        if (!isAutoClearSettings({ cycle: false, todo: true }, DEFAULTS)) throw new Error('valid map rejected');
        if (!isAutoClearSettings({ cycle: false, todo: true, someday: true }, DEFAULTS)) throw new Error('open map rejected');
        if (isAutoClearSettings({ cycle: false }, DEFAULTS)) throw new Error('missing todo accepted');
        if (isAutoClearSettings({ cycle: 'no', todo: true }, DEFAULTS)) throw new Error('string accepted');
        if (isAutoClearSettings(null, DEFAULTS)) throw new Error('null accepted');
        if (isAutoClearSettings({ cycle: false, todo: true }, null)) throw new Error('no defaults accepted');
    });

    await test('setAutoClearSettings replaces the map with a repaired copy and keeps extra modes', () => {
        const task = { autoClear: { cycle: false, todo: false } };
        const incoming = { cycle: true, todo: 'bad', someday: true };
        const mode = setAutoClearSettings(task, incoming, cycleRoutine, DEFAULTS);
        if (mode !== 'cycle') throw new Error(`mode ${mode}`);
        if (task.autoClear === incoming) throw new Error('should copy, not alias, the incoming map');
        if (task.autoClear.cycle !== true || task.autoClear.todo !== DEFAULTS.todo) throw new Error(`map ${JSON.stringify(task.autoClear)}`);
        if (task.autoClear.someday !== true) throw new Error('extra mode dropped');
        if (setAutoClearSettings(task, incoming, todoRoutine, DEFAULTS) !== 'todo') throw new Error('mode should follow the routine');
    });

    await test('setAutoClearSettings fills a null map from defaults; inert without a task or defaults', () => {
        const task = {};
        setAutoClearSettings(task, null, todoRoutine, DEFAULTS);
        if (JSON.stringify(task.autoClear) !== JSON.stringify(DEFAULTS)) throw new Error('defaults not used');
        if (setAutoClearSettings(null, {}, cycleRoutine, DEFAULTS) !== null) throw new Error('null task');
        if (setAutoClearSettings({}, {}, cycleRoutine, null) !== null) throw new Error('missing defaults');
    });

    await test('autoClearFields returns a copy of the map under the stored name', () => {
        const settings = { cycle: true, todo: false };
        const fields = autoClearFields({ settings, defaults: DEFAULTS });
        if (Object.keys(fields).join(',') !== 'autoClear') throw new Error(`unexpected keys: ${Object.keys(fields)}`);
        if (fields.autoClear === settings) throw new Error('must copy, not alias');
        if (fields.autoClear.cycle !== true || fields.autoClear.todo !== false) throw new Error(JSON.stringify(fields));
    });

    await test('autoClearFields: a value with a mode sets that mode; without a mode it is ignored; no map copies defaults', () => {
        const forced = autoClearFields({ settings: { cycle: false, todo: false }, mode: 'cycle', value: true, defaults: DEFAULTS });
        if (forced.autoClear.cycle !== true || forced.autoClear.todo !== false) throw new Error(`forced: ${JSON.stringify(forced)}`);
        const noMode = autoClearFields({ settings: { cycle: false, todo: false }, value: true, defaults: DEFAULTS });
        if (noMode.autoClear.cycle !== false) throw new Error('a value without a mode has nothing to apply to');
        const noMap = autoClearFields({ settings: null, mode: 'todo', defaults: DEFAULTS });
        if (noMap.autoClear === DEFAULTS) throw new Error('defaults must be copied');
        if (JSON.stringify(noMap.autoClear) !== JSON.stringify(DEFAULTS)) throw new Error('defaults not used');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
