/**
 * DataAccess Tests
 * Tests for modules/core/dataAccess.js — the legacy AppState wrapper layer
 * (loadMiniCycleData / autoSave / updateCycleData) + DI injection.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runDataAccessTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/dataAccess.js?v=${cacheBuster}`);
    const {
        setDataAccessDeps, loadMiniCycleData, autoSave, updateCycleData, createDataAccess
    } = mod;

    resultsDiv.innerHTML = '<h2>DataAccess Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // In-memory mock AppState — does NOT touch localStorage (tests run while live
    // app data is protected/restored by createProtectedTest, but we avoid the
    // localStorage fallback path entirely by keeping AppState.isReady() === true).
    const makeAppState = (initialState, { ready = true } = {}) => {
        let st = initialState;
        return {
            isReady: () => ready,
            get: () => st,
            update: async (updater, immediate) => {
                if (typeof updater === 'function') updater(st);
                // Faithful to the real AppState.update: metadata is stamped
                // AFTER the producer runs, on every call (appState.js). The
                // in-producer stamps were removed as dead (review F-002/F-003).
                st.metadata.lastModified = Date.now();
                makeAppState._lastImmediate = immediate;
                return st;
            },
            _setState: (s) => { st = s; }
        };
    };

    const baseState = () => ({
        metadata: { lastModified: 'old', version: '2.5' },
        appState: { activeCycleId: 'cycle-A' },
        settings: { theme: 'dark' },
        customReminders: { enabled: true, frequencyValue: 15 },
        data: { cycles: { 'cycle-A': { id: 'cycle-A', tasks: [], cycleCount: 2 } } }
    });

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads with all expected exports', () => {
        for (const [n, f] of [['setDataAccessDeps', setDataAccessDeps], ['loadMiniCycleData', loadMiniCycleData],
                              ['autoSave', autoSave], ['updateCycleData', updateCycleData], ['createDataAccess', createDataAccess]]) {
            if (typeof f !== 'function') throw new Error(`${n}: expected function, got ${typeof f}`);
        }
    });

    await test('createDataAccess returns an object bundling the 3 wrappers', () => {
        const da = createDataAccess();
        if (typeof da.loadMiniCycleData !== 'function') throw new Error('missing loadMiniCycleData');
        if (typeof da.autoSave !== 'function') throw new Error('missing autoSave');
        if (typeof da.updateCycleData !== 'function') throw new Error('missing updateCycleData');
    });

    // ── loadMiniCycleData ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📥 loadMiniCycleData</h4>';

    await test('returns legacy shape from a ready AppState', () => {
        setDataAccessDeps({ AppState: makeAppState(baseState()) });
        const result = loadMiniCycleData();
        if (!result) throw new Error('expected a result object');
        if (result.activeCycle !== 'cycle-A') throw new Error('wrong activeCycle: ' + result.activeCycle);
        if (!result.cycles['cycle-A']) throw new Error('cycles not surfaced');
        if (result.settings.theme !== 'dark') throw new Error('settings not surfaced');
    });

    await test('surfaces customReminders from root when present', () => {
        setDataAccessDeps({ AppState: makeAppState(baseState()) });
        const result = loadMiniCycleData();
        if (!result.reminders || result.reminders.frequencyValue !== 15) {
            throw new Error('customReminders not surfaced: ' + JSON.stringify(result.reminders));
        }
    });

    await test('falls back to DEFAULT_REMINDERS when customReminders missing', () => {
        const st = baseState();
        delete st.customReminders;
        setDataAccessDeps({ AppState: makeAppState(st) });
        const result = loadMiniCycleData();
        if (!result.reminders) throw new Error('reminders missing');
        if (result.reminders.enabled !== false || result.reminders.frequencyValue !== 30) {
            throw new Error('default reminders wrong: ' + JSON.stringify(result.reminders));
        }
        if (result.reminders.frequencyUnit !== 'minutes') throw new Error('default unit wrong');
    });

    // ── autoSave: guard / no-op paths ─────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">💾 autoSave guards</h4>';

    await test('returns error when AppState not ready', async () => {
        setDataAccessDeps({ AppState: makeAppState(baseState(), { ready: false }) });
        const r = await autoSave([{ id: 't1', text: 'x' }]);
        if (r.success !== false || r.error !== 'AppState not ready') {
            throw new Error('expected not-ready guard, got ' + JSON.stringify(r));
        }
    });

    await test('null task list is a state-first no-op (does not save)', async () => {
        const as = makeAppState(baseState());
        let updateCalled = false;
        as.update = async () => { updateCalled = true; };
        setDataAccessDeps({ AppState: as });
        const r = await autoSave(null);
        if (r.success !== false || r.reason !== 'state-first') {
            throw new Error('expected state-first no-op, got ' + JSON.stringify(r));
        }
        if (updateCalled) throw new Error('autoSave(null) must not call AppState.update');
    });

    await test('refuses to save tasks missing id or text (invalid-tasks guard)', async () => {
        const as = makeAppState(baseState());
        let updateCalled = false;
        as.update = async () => { updateCalled = true; };
        setDataAccessDeps({ AppState: as });
        const r = await autoSave([{ id: 't1', text: 'ok' }, { text: 'no-id' }]);
        if (r.success !== false || r.guard !== 'invalid-tasks') {
            throw new Error('expected invalid-tasks guard, got ' + JSON.stringify(r));
        }
        if (updateCalled) throw new Error('must not save when invalid tasks present');
    });

    // ── autoSave: happy path ──────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">💾 autoSave happy path</h4>';

    await test('writes valid task list into the active cycle', async () => {
        const as = makeAppState(baseState());
        setDataAccessDeps({ AppState: as });
        const tasks = [{ id: 't1', text: 'one' }, { id: 't2', text: 'two' }];
        const r = await autoSave(tasks, true);
        if (r.success !== true || r.taskCount !== 2) throw new Error('bad result: ' + JSON.stringify(r));
        if (as.get().data.cycles['cycle-A'].tasks !== tasks) {
            throw new Error('tasks not written to active cycle');
        }
    });

    await test('returns failure when active cycle id is missing in state', async () => {
        const st = baseState();
        st.appState.activeCycleId = null;
        setDataAccessDeps({ AppState: makeAppState(st) });
        const r = await autoSave([{ id: 't1', text: 'x' }]);
        if (r.success !== false) throw new Error('expected failure when no active cycle');
        if (!/active cycle/i.test(r.error)) throw new Error('unexpected error text: ' + r.error);
    });

    await test('returns failure when active cycle not found in cycles map', async () => {
        const st = baseState();
        st.appState.activeCycleId = 'cycle-MISSING';
        setDataAccessDeps({ AppState: makeAppState(st) });
        const r = await autoSave([{ id: 't1', text: 'x' }]);
        if (r.success !== false) throw new Error('expected failure for missing cycle');
        if (!/not found/i.test(r.error)) throw new Error('unexpected error text: ' + r.error);
    });

    // ── updateCycleData ───────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 updateCycleData</h4>';

    await test('returns false when AppState not ready', async () => {
        setDataAccessDeps({ AppState: makeAppState(baseState(), { ready: false }) });
        const ok = await updateCycleData('cycle-A', c => { c.cycleCount = 99; });
        if (ok !== false) throw new Error('expected false when not ready');
    });

    await test('applies producer fn to the target cycle and bumps lastModified', async () => {
        const as = makeAppState(baseState());
        setDataAccessDeps({ AppState: as });
        const ok = await updateCycleData('cycle-A', c => { c.cycleCount = 7; });
        if (ok !== true) throw new Error('expected true');
        if (as.get().data.cycles['cycle-A'].cycleCount !== 7) throw new Error('producer did not apply');
        if (as.get().metadata.lastModified === 'old') throw new Error('lastModified not updated');
    });

    await test('no-op (but returns true) when the target cycle does not exist', async () => {
        const as = makeAppState(baseState());
        setDataAccessDeps({ AppState: as });
        let producerRan = false;
        const ok = await updateCycleData('cycle-NOPE', () => { producerRan = true; });
        if (ok !== true) throw new Error('expected true (update wrapper succeeded)');
        if (producerRan) throw new Error('producer must not run for a missing cycle');
        // NOTE: lastModified still bumps — AppState.update stamps on every
        // call, cycle match or not. (The old assertion that it stayed 'old'
        // only ever held against the unfaithful mock.)
        if (as.get().metadata.lastModified === 'old') throw new Error('update wrapper must still have run (and stamped)');
    });

    await test('returns false and swallows error when producer throws', async () => {
        const as = makeAppState(baseState());
        setDataAccessDeps({ AppState: as });
        const ok = await updateCycleData('cycle-A', () => { throw new Error('boom'); });
        if (ok !== false) throw new Error('expected false when producer throws');
    });

    // ── results ──────────────────────────────────────────────────────────────
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
