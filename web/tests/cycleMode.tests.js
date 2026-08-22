/**
 * CycleMode Tests
 * Tests for modules/utils/cycleMode.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/cycleMode.js?v=${cacheBuster}`);
    const { getCycleMode, getAllDoneHintKey, getDeleteSettingsMode, syncTaskDeleteWhenComplete,
            resolveDeleteWhenComplete, getTaskResetIndicator } = mod;
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

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
