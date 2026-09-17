/**
 * CycleMode Tests
 * Tests for modules/utils/cycleMode.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/cycleMode.js?v=${cacheBuster}`);
    const { getCycleMode, getAllDoneHintKey, getDeleteSettingsMode, syncTaskDeleteWhenComplete,
            resolveDeleteWhenComplete, getTaskResetIndicator,
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

    // ── getDeleteSettingsMode ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗝️ getDeleteSettingsMode</h4>';

    await test('deleteWhenCompleteSettings is keyed by two modes, not three', () => {
        // auto and manual routines both RESET rather than delete, so both read
        // the `cycle` key — the three-way getCycleMode must not leak through.
        if (getDeleteSettingsMode({ deleteCheckedTasks: true }) !== 'todo') throw new Error('todo');
        if (getDeleteSettingsMode({ autoReset: true }) !== 'cycle') throw new Error('auto should map to cycle');
        if (getDeleteSettingsMode({}) !== 'cycle') throw new Error('manual should map to cycle');
        if (getDeleteSettingsMode(null) !== 'cycle') throw new Error('null should map to cycle');
    });

    // ── syncTaskDeleteWhenComplete ───────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 syncTaskDeleteWhenComplete</h4>';

    await test('derives deleteWhenComplete from the active mode', () => {
        const task = { deleteWhenCompleteSettings: { cycle: true, todo: false }, deleteWhenComplete: false };
        syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
        if (task.deleteWhenComplete !== true) throw new Error('cycle mode value not applied');
        syncTaskDeleteWhenComplete(task, 'todo', DEFAULTS);
        if (task.deleteWhenComplete !== false) throw new Error('todo mode value not applied');
    });

    await test('repairs PER KEY — the other mode\'s valid value survives', () => {
        // The regression this helper exists to kill: whole-object replacement turned
        // {cycle:true, todo:<bad>} into {cycle:false, todo:true}, silently discarding
        // the user's Cycle setting on load.
        const task = { deleteWhenCompleteSettings: { cycle: true, todo: 'nope' } };
        const result = syncTaskDeleteWhenComplete(task, 'todo', DEFAULTS);
        if (task.deleteWhenCompleteSettings.cycle !== true) {
            throw new Error('the valid cycle value was discarded during repair');
        }
        if (task.deleteWhenCompleteSettings.todo !== DEFAULTS.todo) throw new Error('bad key not defaulted');
        if (!result.repaired) throw new Error('should report repaired');
    });

    await test('rebuilds a missing settings map from defaults', () => {
        const task = {};
        const result = syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
        if (task.deleteWhenCompleteSettings.cycle !== DEFAULTS.cycle) throw new Error('cycle default');
        if (task.deleteWhenCompleteSettings.todo !== DEFAULTS.todo) throw new Error('todo default');
        if (!result.repaired || !result.changed) throw new Error('should report repaired + changed');
    });

    await test('rebuilds a non-object settings value', () => {
        for (const bad of ['x', 42, true, null]) {
            const task = { deleteWhenCompleteSettings: bad };
            syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
            if (typeof task.deleteWhenCompleteSettings !== 'object') throw new Error(`not repaired for ${bad}`);
            if (task.deleteWhenCompleteSettings.todo !== DEFAULTS.todo) throw new Error(`bad rebuild for ${bad}`);
        }
    });

    await test('never assigns a non-boolean to deleteWhenComplete', () => {
        // routineLoader used to derive `undefined` when the active mode's key was
        // corrupt, then write it straight onto the task.
        const task = { deleteWhenCompleteSettings: { cycle: undefined, todo: undefined } };
        syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
        if (typeof task.deleteWhenComplete !== 'boolean') {
            throw new Error(`assigned ${typeof task.deleteWhenComplete}`);
        }
    });

    await test('is idempotent — a clean task reports no change', () => {
        // modeManager documents "callers that only touched autoReset pay no cost",
        // and routineLoader drives its tasksModified flag off this.
        const task = { deleteWhenCompleteSettings: { cycle: false, todo: true }, deleteWhenComplete: false };
        const result = syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
        if (result.changed || result.repaired) throw new Error('clean task should report no change');
    });

    await test('reports changed (not repaired) when only the derived value was stale', () => {
        const task = { deleteWhenCompleteSettings: { cycle: false, todo: true }, deleteWhenComplete: true };
        const result = syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
        if (result.repaired) throw new Error('settings were valid — should not report repaired');
        if (!result.changed) throw new Error('stale derived value should report changed');
        if (task.deleteWhenComplete !== false) throw new Error('value not corrected');
    });

    await test('drops unknown keys from the settings map', () => {
        const task = { deleteWhenCompleteSettings: { cycle: true, todo: true, bogus: true } };
        const result = syncTaskDeleteWhenComplete(task, 'cycle', DEFAULTS);
        if ('bogus' in task.deleteWhenCompleteSettings) throw new Error('unknown key survived');
        if (!result.repaired) throw new Error('dropping a key is a rebuild — should report repaired');
    });

    await test('covers every key in the defaults map, not a hardcoded pair', () => {
        // A third mode must stay covered without editing this helper.
        const task = {};
        syncTaskDeleteWhenComplete(task, 'cycle', { cycle: false, todo: true, someday: true });
        if (task.deleteWhenCompleteSettings.someday !== true) throw new Error('extra mode not carried');
    });

    await test('returns safely for a null task or missing defaults', () => {
        const a = syncTaskDeleteWhenComplete(null, 'cycle', DEFAULTS);
        if (a.changed || a.repaired) throw new Error('null task should be inert');
        const b = syncTaskDeleteWhenComplete({}, 'cycle', null);
        if (b.changed || b.repaired) throw new Error('missing defaults should be inert');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">resolveDeleteWhenComplete — priority order</h4>';

    const resolve = (settings, legacy, mode) =>
        resolveDeleteWhenComplete({ settings, legacy, mode, defaults: DEFAULTS });

    await test('falls back to the legacy field when settings are MISSING', () => {
        // Regression: an earlier version validated the settings map wholesale and
        // substituted defaults, which made this branch unreachable — a task whose
        // only signal was deleteWhenComplete:true resolved to the mode default.
        if (resolve(undefined, true, 'cycle') !== true) {
            throw new Error('missing settings + legacy true should resolve true, not the cycle default');
        }
        if (resolve(undefined, false, 'todo') !== false) {
            throw new Error('missing settings + legacy false should resolve false, not the todo default');
        }
    });

    await test('falls back to the legacy field when settings are MALFORMED', () => {
        if (resolve({ cycle: 'yes', todo: 1 }, true, 'cycle') !== true) {
            throw new Error('non-boolean settings should not mask a valid legacy value');
        }
    });

    await test('honours a PARTIALLY populated settings map for the mode it covers', () => {
        // Per key, not wholesale — the same rule syncTaskDeleteWhenComplete follows.
        // { cycle: true } is a usable answer in cycle mode even with todo missing.
        if (resolve({ cycle: true }, undefined, 'cycle') !== true) {
            throw new Error('a valid key for the active mode must win');
        }
        // ...and must NOT be borrowed for the mode it does not cover.
        if (resolve({ cycle: true }, false, 'todo') !== false) {
            throw new Error('a key for the other mode must not leak across modes');
        }
    });

    await test('falls back to the per-mode default when NEITHER source is present', () => {
        if (resolve(undefined, undefined, 'cycle') !== DEFAULTS.cycle) {
            throw new Error('cycle with no signal should use the cycle default');
        }
        if (resolve(undefined, undefined, 'todo') !== DEFAULTS.todo) {
            throw new Error('todo with no signal should use the todo default');
        }
    });

    await test('valid settings outrank the legacy field', () => {
        if (resolve({ cycle: true, todo: false }, false, 'cycle') !== true) {
            throw new Error('settings are canonical and must win over the legacy mirror');
        }
    });

    await test('getTaskResetIndicator matches the routine list branch table', () => {
        const cases = [
            [{ deleteWhenComplete: true,  isRecurring: false, mode: 'todo'  }, null],
            [{ deleteWhenComplete: false, isRecurring: false, mode: 'todo'  }, 'keep'],
            [{ deleteWhenComplete: false, isRecurring: false, mode: 'cycle' }, null],
            [{ deleteWhenComplete: true,  isRecurring: false, mode: 'cycle' }, 'clear'],
            [{ deleteWhenComplete: true,  isRecurring: true,  mode: 'cycle' }, null],
            [{ deleteWhenComplete: false, isRecurring: true,  mode: 'cycle' }, 'keep']
        ];
        for (const [args, want] of cases) {
            const got = getTaskResetIndicator(args);
            if (got !== want) {
                throw new Error(`${JSON.stringify(args)} -> ${got}, expected ${want}`);
            }
        }
    });

    // ── Naming helpers: routine ──────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗂️ Routine helpers (read/write the stored cycle keys)</h4>';

    // Schema 2.5 shape: routines live under data.cycles, the open one in appState.activeCycleId
    const makeState = () => ({
        data: { cycles: {
            r1: { title: 'Morning', cycleCount: 3, tasks: [{ id: 't1' }] },
            r2: { title: 'Evening', cycleCount: 0, tasks: [] }
        } },
        appState: { activeCycleId: 'r1' }
    });

    await test('getRoutines and getActiveRoutineId read the stored keys', () => {
        const state = makeState();
        if (getRoutines(state) !== state.data.cycles) throw new Error('getRoutines should return data.cycles');
        if (getActiveRoutineId(state) !== 'r1') throw new Error(`getActiveRoutineId: ${getActiveRoutineId(state)}`);
    });

    await test('getActiveRoutine returns the open routine itself, so producer edits land in state', () => {
        const state = makeState();
        const routine = getActiveRoutine(state);
        if (routine !== state.data.cycles.r1) throw new Error('should return the stored routine object, not a copy');
        routine.cycleCount += 1;
        if (state.data.cycles.r1.cycleCount !== 4) throw new Error('an edit through the helper did not reach state');
    });

    await test('getRoutine finds a routine by id and returns null for an unknown id', () => {
        const state = makeState();
        if (getRoutine(state, 'r2')?.title !== 'Evening') throw new Error('r2 not found');
        if (getRoutine(state, 'missing') !== null) throw new Error('unknown id should be null');
        if (getRoutine(state, null) !== null || getRoutine(state, '') !== null) throw new Error('empty id should be null');
    });

    await test('getRoutine ignores inherited names like constructor and toString', () => {
        // The routines map is a plain object — a truthiness lookup would "find" these.
        const state = makeState();
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            if (getRoutine(state, name) !== null) throw new Error(`"${name}" was treated as a routine`);
        }
    });

    await test('routine helpers return null instead of throwing when data is missing', () => {
        for (const bad of [null, undefined, {}, { data: {} }, { appState: {} }]) {
            if (getRoutines(bad) !== null) throw new Error(`getRoutines for ${JSON.stringify(bad)}`);
            if (getActiveRoutineId(bad) !== null) throw new Error(`getActiveRoutineId for ${JSON.stringify(bad)}`);
            if (getActiveRoutine(bad) !== null) throw new Error(`getActiveRoutine for ${JSON.stringify(bad)}`);
        }
        const pointingNowhere = makeState();
        pointingNowhere.appState.activeCycleId = 'gone';
        if (getActiveRoutine(pointingNowhere) !== null) throw new Error('an id with no routine should be null');
    });

    await test('setActiveRoutineId writes activeCycleId and creates appState if needed', () => {
        const state = makeState();
        setActiveRoutineId(state, 'r2');
        if (state.appState.activeCycleId !== 'r2') throw new Error('activeCycleId not written');
        if (getActiveRoutine(state)?.title !== 'Evening') throw new Error('helper did not follow the new id');

        const bare = { data: { cycles: {} } };
        setActiveRoutineId(bare, 'r9');
        if (bare.appState?.activeCycleId !== 'r9') throw new Error('appState should be created');

        setActiveRoutineId(null, 'r1'); // must not throw
    });

    await test('routine helpers never add new keys to stored data', () => {
        // The stored schema keeps its names until Schema 2.6 — an alias key would be
        // saved alongside the real one and drift from it after a reload.
        const state = makeState();
        getActiveRoutine(state);
        setActiveRoutineId(state, 'r2');
        const saved = JSON.stringify(state);
        for (const newName of ['routines', 'activeRoutineId', 'routineId']) {
            if (saved.includes(`"${newName}"`)) throw new Error(`stored data gained a "${newName}" key`);
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
        // An empty routine is not a finished one — every() on [] is true, so guard it.
        if (areAllTasksComplete({ tasks: [] }) !== false) throw new Error('empty routine must not count as complete');
        if (areAllTasksComplete(null) !== false) throw new Error('null');
    });

    await test('areAllTasksComplete treats a missing or non-boolean completed as not complete', () => {
        if (areAllTasksComplete({ tasks: [{ completed: true }, {}] }) !== false) throw new Error('missing flag');
        if (areAllTasksComplete({ tasks: [{ completed: 'yes' }] }) !== false) throw new Error('string flag');
        if (areAllTasksComplete({ tasks: [{ completed: true }, null] }) !== false) throw new Error('null task');
    });

    // ── Naming helpers: autoClear ────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 autoClear helpers (Clear on Reset / Marked for Clearing)</h4>';

    const cycleRoutine = { autoReset: true };
    const todoRoutine = { deleteCheckedTasks: true };

    await test('autoClear names are the existing helpers, not copies that could drift', () => {
        if (getAutoClearMode !== getDeleteSettingsMode) throw new Error('getAutoClearMode');
        if (syncTaskAutoClear !== syncTaskDeleteWhenComplete) throw new Error('syncTaskAutoClear');
        if (resolveAutoClear !== resolveDeleteWhenComplete) throw new Error('resolveAutoClear');
    });

    await test('getAutoClear answers for the routine\'s current mode', () => {
        const task = { deleteWhenCompleteSettings: { cycle: true, todo: false }, deleteWhenComplete: true };
        if (getAutoClear(task, cycleRoutine, DEFAULTS) !== true) throw new Error('Clear on Reset (cycle) should be on');
        if (getAutoClear(task, todoRoutine, DEFAULTS) !== false) throw new Error('Marked for Clearing (todo) should be off');
    });

    await test('getAutoClear falls back to the flat field, then the mode default', () => {
        if (getAutoClear({ deleteWhenComplete: true }, cycleRoutine, DEFAULTS) !== true) {
            throw new Error('flat field should be used when there is no settings map');
        }
        if (getAutoClear({}, todoRoutine, DEFAULTS) !== DEFAULTS.todo) throw new Error('todo default');
        if (getAutoClear({}, cycleRoutine, DEFAULTS) !== DEFAULTS.cycle) throw new Error('cycle default');
    });

    await test('setAutoClear makes the same write as the task toggle and keeps the other mode', () => {
        // taskButtons.js writes task.deleteWhenCompleteSettings[mode] AND task.deleteWhenComplete.
        const task = { deleteWhenCompleteSettings: { cycle: false, todo: false }, deleteWhenComplete: false };
        const written = setAutoClear(task, cycleRoutine, true, DEFAULTS);
        if (written !== 'cycle') throw new Error(`wrote mode ${written}`);
        if (task.deleteWhenCompleteSettings.cycle !== true) throw new Error('per-mode setting not written');
        if (task.deleteWhenComplete !== true) throw new Error('flat mirror not written');
        if (task.deleteWhenCompleteSettings.todo !== false) throw new Error('the To-Do setting was changed');

        setAutoClear(task, todoRoutine, true, DEFAULTS);
        if (task.deleteWhenCompleteSettings.cycle !== true) throw new Error('turning on To-Do lost the Cycle setting');
        if (getAutoClear(task, todoRoutine, DEFAULTS) !== true) throw new Error('round trip in To-Do mode');
        if (getAutoClear(task, cycleRoutine, DEFAULTS) !== true) throw new Error('round trip in Cycle mode');
    });

    await test('setAutoClear repairs a missing or invalid settings map before writing', () => {
        const task = { deleteWhenCompleteSettings: 'garbage' };
        setAutoClear(task, cycleRoutine, true, DEFAULTS);
        if (task.deleteWhenCompleteSettings.cycle !== true) throw new Error('value not written after repair');
        if (task.deleteWhenCompleteSettings.todo !== DEFAULTS.todo) throw new Error('other mode not defaulted');
    });

    await test('setAutoClear never modifies the frozen defaults object', () => {
        // A task can end up holding DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS by reference;
        // editing it in place would throw in strict mode (or silently corrupt defaults).
        const task = { deleteWhenCompleteSettings: DEFAULTS };
        const before = JSON.stringify(DEFAULTS);
        setAutoClear(task, cycleRoutine, !DEFAULTS.cycle, DEFAULTS);
        if (JSON.stringify(DEFAULTS) !== before) throw new Error('the shared defaults object was changed');
        if (task.deleteWhenCompleteSettings === DEFAULTS) throw new Error('task should get its own settings object');
        if (task.deleteWhenCompleteSettings.cycle !== !DEFAULTS.cycle) throw new Error('value not written');
    });

    await test('setAutoClear only writes the stored field names', () => {
        const task = { id: 't1' };
        setAutoClear(task, todoRoutine, false, DEFAULTS);
        const saved = JSON.stringify(task);
        if (saved.includes('"autoClear"')) throw new Error('stored task gained an "autoClear" key');
        if (!saved.includes('"deleteWhenComplete"')) throw new Error('flat field missing');
        if (!saved.includes('"deleteWhenCompleteSettings"')) throw new Error('settings map missing');
    });

    await test('setAutoClear is inert for a missing task or missing defaults', () => {
        if (setAutoClear(null, cycleRoutine, true, DEFAULTS) !== null) throw new Error('null task');
        const task = {};
        if (setAutoClear(task, cycleRoutine, true, null) !== null) throw new Error('missing defaults');
        if ('deleteWhenComplete' in task) throw new Error('task was written without defaults');
    });

    // ── map-level helpers (Rename A reader sweep) ────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 autoClear map helpers</h4>';

    await test('getAutoClearForMode reads the given mode, not the routine', () => {
        const task = { deleteWhenCompleteSettings: { cycle: true, todo: false }, deleteWhenComplete: false };
        if (getAutoClearForMode(task, 'cycle', DEFAULTS) !== true) throw new Error('cycle key ignored');
        if (getAutoClearForMode(task, 'todo', DEFAULTS) !== false) throw new Error('todo key ignored');
        if (getAutoClear(task, cycleRoutine, DEFAULTS) !== getAutoClearForMode(task, 'cycle', DEFAULTS)) {
            throw new Error('getAutoClear must agree with the mode-keyed read');
        }
    });

    await test('getAutoClearForMode falls back to the mirror, then the default', () => {
        if (getAutoClearForMode({ deleteWhenComplete: true }, 'cycle', DEFAULTS) !== true) throw new Error('mirror ignored');
        if (getAutoClearForMode({}, 'todo', DEFAULTS) !== DEFAULTS.todo) throw new Error('default ignored');
        if (getAutoClearForMode(null, 'cycle', DEFAULTS) !== DEFAULTS.cycle) throw new Error('null task should read the default');
    });

    await test('getAutoClearSettings returns the stored map or undefined', () => {
        const map = { cycle: true, todo: true };
        if (getAutoClearSettings({ deleteWhenCompleteSettings: map }) !== map) throw new Error('should return the stored object itself');
        if (getAutoClearSettings({}) !== undefined) throw new Error('missing map should be undefined');
        if (getAutoClearSettings({ deleteWhenCompleteSettings: null }) !== undefined) throw new Error('null map should be undefined');
        if (getAutoClearSettings(null) !== undefined) throw new Error('null task should be undefined');
    });

    await test('isAutoClearSettings requires a boolean for every default key', () => {
        if (!isAutoClearSettings({ cycle: false, todo: true }, DEFAULTS)) throw new Error('valid map rejected');
        if (isAutoClearSettings({ cycle: false }, DEFAULTS)) throw new Error('missing todo accepted');
        if (isAutoClearSettings({ cycle: 'no', todo: true }, DEFAULTS)) throw new Error('string accepted');
        if (isAutoClearSettings(null, DEFAULTS)) throw new Error('null accepted');
        if (isAutoClearSettings('cycle', DEFAULTS)) throw new Error('string accepted as map');
        if (isAutoClearSettings({ cycle: false, todo: true }, null)) throw new Error('no defaults accepted');
    });

    await test('setAutoClearSettings replaces the map and re-derives the mirror for the routine mode', () => {
        const task = { deleteWhenCompleteSettings: { cycle: false, todo: false }, deleteWhenComplete: false };
        const incoming = { cycle: true, todo: false };
        const mode = setAutoClearSettings(task, incoming, cycleRoutine, DEFAULTS);
        if (mode !== 'cycle') throw new Error(`mode ${mode}`);
        if (task.deleteWhenCompleteSettings === incoming) throw new Error('should copy, not alias, the incoming map');
        if (task.deleteWhenCompleteSettings.cycle !== true || task.deleteWhenCompleteSettings.todo !== false) {
            throw new Error(`map ${JSON.stringify(task.deleteWhenCompleteSettings)}`);
        }
        if (task.deleteWhenComplete !== true) throw new Error('mirror not re-derived for cycle mode');
        setAutoClearSettings(task, incoming, todoRoutine, DEFAULTS);
        if (task.deleteWhenComplete !== false) throw new Error('mirror not re-derived for todo mode');
    });

    await test('setAutoClearSettings fills a null map from defaults and repairs bad keys', () => {
        const task = {};
        setAutoClearSettings(task, null, todoRoutine, DEFAULTS);
        if (JSON.stringify(task.deleteWhenCompleteSettings) !== JSON.stringify(DEFAULTS)) throw new Error('defaults not used');
        if (task.deleteWhenComplete !== DEFAULTS.todo) throw new Error('mirror not derived');
        const bad = {};
        setAutoClearSettings(bad, { cycle: 'yes', todo: true, extra: 1 }, cycleRoutine, DEFAULTS);
        if (bad.deleteWhenCompleteSettings.cycle !== DEFAULTS.cycle) throw new Error('bad key not repaired');
        if ('extra' in bad.deleteWhenCompleteSettings) throw new Error('unknown key kept');
        if (setAutoClearSettings(null, {}, cycleRoutine, DEFAULTS) !== null) throw new Error('null task');
        if (setAutoClearSettings({}, {}, cycleRoutine, null) !== null) throw new Error('missing defaults');
    });

    await test('autoClearFields derives the active value from the map for a known mode', () => {
        const fields = autoClearFields({ settings: { cycle: true, todo: false }, mode: 'cycle', defaults: DEFAULTS });
        if (fields.deleteWhenComplete !== true) throw new Error(`cycle → ${fields.deleteWhenComplete}`);
        if (fields.deleteWhenCompleteSettings.cycle !== true) throw new Error('map not carried');
        const todo = autoClearFields({ settings: { cycle: true, todo: false }, mode: 'todo', defaults: DEFAULTS });
        if (todo.deleteWhenComplete !== false) throw new Error(`todo → ${todo.deleteWhenComplete}`);
    });

    await test('autoClearFields: explicit value wins, no mode leaves the active value undefined, no map copies defaults', () => {
        const forced = autoClearFields({ settings: { cycle: false, todo: false }, mode: 'cycle', value: true, defaults: DEFAULTS });
        if (forced.deleteWhenComplete !== true) throw new Error('explicit value ignored');
        const noMode = autoClearFields({ settings: { cycle: true, todo: true }, defaults: DEFAULTS });
        if (noMode.deleteWhenComplete !== undefined) throw new Error(`no mode → ${noMode.deleteWhenComplete}`);
        const noMap = autoClearFields({ settings: null, mode: 'todo', defaults: DEFAULTS });
        if (noMap.deleteWhenCompleteSettings === DEFAULTS) throw new Error('defaults must be copied');
        if (JSON.stringify(noMap.deleteWhenCompleteSettings) !== JSON.stringify(DEFAULTS)) throw new Error('defaults not used');
        if (noMap.deleteWhenComplete !== DEFAULTS.todo) throw new Error('active value not derived from defaults');
        const keys = Object.keys(autoClearFields({ defaults: DEFAULTS })).sort().join(',');
        if (keys !== 'deleteWhenComplete,deleteWhenCompleteSettings') throw new Error(`unexpected keys: ${keys}`);
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
