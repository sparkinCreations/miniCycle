/**
 * UIOrchestrator Tests
 * Tests for modules/ui/uiOrchestrator.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runUIOrchestratorTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/uiOrchestrator.js?v=${cacheBuster}`);
    const { UIOrchestrator, setUIOrchestratorDependencies } = mod;

    resultsDiv.innerHTML = '<h2>UIOrchestrator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── helpers ───────────────────────────────────────────────────────────────
    // Track calls into each injected UI function. Note: deps are module-level
    // (Proxy over di.resolve()), so setting deps affects ALL instances. We set a
    // fresh deps object per test to isolate.
    const makeSpies = () => {
        const log = [];
        const spy = (name) => (...args) => { log.push({ name, args }); };
        return { log, spy };
    };

    const makeAppState = (state) => ({ get: () => state, isReady: () => true });

    // Build a deps object + wire it, return spies and a fresh orchestrator.
    const setup = (state = {}, extra = {}) => {
        const { log, spy } = makeSpies();
        const deps = {
            AppState: makeAppState(state),
            TaskRenderer: { renderTasks: spy('renderTasks') },
            TaskDOMManager: {
                patchTask: spy('patchTask'),
                removeTask: spy('removeTask')
            },
            updateProgressBar: spy('updateProgressBar'),
            updateStatsPanel: spy('updateStatsPanel'),
            checkCompleteAllButton: spy('checkCompleteAllButton'),
            updateMainMenuHeader: spy('updateMainMenuHeader'),
            checkOverdueTasks: spy('checkOverdueTasks'),
            updateFirstLastMarkers: spy('updateFirstLastMarkers'),
            setArrowsEnabled: spy('setArrowsEnabled'),
            showNotification: spy('showNotification'),
            ...extra
        };
        setUIOrchestratorDependencies(deps);
        return { log, deps, orch: new UIOrchestrator() };
    };

    const calls = (log, name) => log.filter(c => c.name === name);

    // ── exports / load checks (kept) ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('setUIOrchestratorDependencies + requestUIUpdate + UIOrchestrator exported', () => {
        if (typeof mod.setUIOrchestratorDependencies !== 'function') throw new Error('setUIOrchestratorDependencies missing');
        if (typeof mod.requestUIUpdate !== 'function') throw new Error('requestUIUpdate missing');
        if (typeof mod.UIOrchestrator !== 'function') throw new Error('UIOrchestrator class missing');
    });

    await test('ui convenience object exposes the documented operations', () => {
        const ops = ['fullRender', 'patchTasks', 'removeTasks', 'afterTaskChange', 'syncArrows', 'syncAll'];
        ops.forEach(op => {
            if (typeof mod.ui[op] !== 'function') throw new Error(`ui.${op} missing`);
        });
    });

    // ── _mergeIntents (pure logic) ────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧬 _mergeIntents</h4>';

    await test('merge with null existing returns a copy of incoming', () => {
        const { orch } = setup();
        const incoming = { progress: true };
        const merged = orch._mergeIntents(null, incoming);
        if (!merged.progress) throw new Error('progress not carried');
        if (merged === incoming) throw new Error('should be a copy, not same ref');
    });

    await test('merge OR-combines boolean flags', () => {
        const { orch } = setup();
        const merged = orch._mergeIntents({ progress: true }, { stats: true });
        if (!merged.progress || !merged.stats) throw new Error('flags not OR-merged');
    });

    await test('two patch intents union taskIds and changedFields', () => {
        const { orch } = setup();
        const a = { tasks: { type: 'patch', taskIds: ['t1'], changedFields: ['completed'] } };
        const b = { tasks: { type: 'patch', taskIds: ['t2', 't1'], changedFields: ['text'] } };
        const merged = orch._mergeIntents(a, b);
        const ids = merged.tasks.taskIds.sort();
        if (ids.join(',') !== 't1,t2') throw new Error('taskIds union wrong: ' + ids.join(','));
        const f = merged.tasks.changedFields.sort();
        if (f.join(',') !== 'completed,text') throw new Error('fields union wrong: ' + f.join(','));
    });

    await test('full + patch upgrades to full', () => {
        const { orch } = setup();
        const merged = orch._mergeIntents(
            { tasks: { type: 'patch', taskIds: ['t1'] } },
            { tasks: { type: 'full' } }
        );
        if (merged.tasks.type !== 'full') throw new Error('did not upgrade to full');
    });

    await test('mixed types (patch + remove) upgrade to full', () => {
        const { orch } = setup();
        const merged = orch._mergeIntents(
            { tasks: { type: 'patch', taskIds: ['t1'] } },
            { tasks: { type: 'remove', taskIds: ['t2'] } }
        );
        if (merged.tasks.type !== 'full') throw new Error('mixed types should upgrade to full, got ' + merged.tasks.type);
    });

    // ── flush dispatch ────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ flush dispatch</h4>';

    await test('flush with no pending intent does nothing (no error, no calls)', () => {
        const { log, orch } = setup();
        orch.flush();
        if (log.length !== 0) throw new Error('flush fired calls with empty intent');
    });

    await test('progress intent calls updateProgressBar once', () => {
        const { log, orch } = setup();
        orch.request({ progress: true });
        orch.flush();
        if (calls(log, 'updateProgressBar').length !== 1) throw new Error('progress not dispatched once');
    });

    await test('stats + completeAllButton + mainMenuHeader dispatch their fns', () => {
        const { log, orch } = setup();
        orch.request({ stats: true, completeAllButton: true, mainMenuHeader: true });
        orch.flush();
        if (calls(log, 'updateStatsPanel').length !== 1) throw new Error('stats missing');
        if (calls(log, 'checkCompleteAllButton').length !== 1) throw new Error('completeAll missing');
        if (calls(log, 'updateMainMenuHeader').length !== 1) throw new Error('mainMenuHeader missing');
    });

    await test('full task render reads tasks from AppState and calls renderTasks', () => {
        const state = {
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 'a' }, { id: 'b' }] } } }
        };
        const { log, orch } = setup(state);
        orch.request({ tasks: { type: 'full' } });
        orch.flush();
        const c = calls(log, 'renderTasks');
        if (c.length !== 1) throw new Error('renderTasks not called once');
        if (c[0].args[0].length !== 2) throw new Error('wrong task count passed to renderTasks');
    });

    await test('patch dispatches patchTask only for ids present in state', () => {
        const state = {
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 'a', text: 'A' }] } } }
        };
        const { log, orch } = setup(state);
        orch.request({ tasks: { type: 'patch', taskIds: ['a', 'ghost'], changedFields: ['text'] } });
        orch.flush();
        const c = calls(log, 'patchTask');
        if (c.length !== 1) throw new Error('expected 1 patchTask call (ghost should be skipped), got ' + c.length);
        if (c[0].args[0] !== 'a') throw new Error('patched wrong task');
        if (c[0].args[1].text !== 'A') throw new Error('did not pass task data from state');
    });

    await test('remove dispatches removeTask per id and syncs markers', () => {
        const { log, orch } = setup();
        orch.request({ tasks: { type: 'remove', taskIds: ['x', 'y'] } });
        orch.flush();
        if (calls(log, 'removeTask').length !== 2) throw new Error('removeTask not called twice');
        if (calls(log, 'updateFirstLastMarkers').length !== 1) throw new Error('markers not synced after remove');
    });

    await test('arrows intent reads moveArrowsVisible and calls setArrowsEnabled', () => {
        const state = { ui: { moveArrowsVisible: true } };
        const { log, orch } = setup(state);
        orch.request({ arrows: true });
        orch.flush();
        const c = calls(log, 'setArrowsEnabled');
        if (c.length !== 1 || c[0].args[0] !== true) throw new Error('arrows not synced with state value');
    });

    // ── coalescing ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🪢 coalescing</h4>';

    await test('two requests before flush coalesce into a single flush', () => {
        const { log, orch } = setup();
        orch.request({ progress: true });
        orch.request({ stats: true });
        orch.flush();
        if (calls(log, 'updateProgressBar').length !== 1) throw new Error('progress count wrong');
        if (calls(log, 'updateStatsPanel').length !== 1) throw new Error('stats count wrong');
        const s = orch.getStats();
        if (s.requestCount !== 2) throw new Error('requestCount should be 2, got ' + s.requestCount);
        if (s.flushCount !== 1) throw new Error('flushCount should be 1, got ' + s.flushCount);
    });

    // ── error isolation ───────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ error handling</h4>';

    await test('renderer throwing is caught and triggers showNotification', () => {
        const state = { appState: { activeCycleId: 'c1' }, data: { cycles: { c1: { tasks: [] } } } };
        const { log, orch } = setup(state, {
            TaskRenderer: { renderTasks: () => { throw new Error('boom'); } }
        });
        orch.request({ tasks: { type: 'full' } });
        orch.flush(); // must not throw
        if (calls(log, 'showNotification').length !== 1) throw new Error('error notification not shown');
    });

    // ── onFlush + stats ───────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📈 stats & onFlush</h4>';

    await test('onFlush callback fires with intent; unsubscribe stops it', () => {
        const { orch } = setup();
        let fires = 0;
        const unsub = orch.onFlush(() => { fires++; });
        orch.request({ progress: true });
        orch.flush();
        if (fires !== 1) throw new Error('callback did not fire');
        unsub();
        orch.request({ progress: true });
        orch.flush();
        if (fires !== 1) throw new Error('callback fired after unsubscribe');
    });

    await test('resetStats zeroes counters', () => {
        const { orch } = setup();
        orch.request({ progress: true });
        orch.flush();
        orch.resetStats();
        const s = orch.getStats();
        if (s.requestCount !== 0 || s.flushCount !== 0) throw new Error('stats not reset');
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
