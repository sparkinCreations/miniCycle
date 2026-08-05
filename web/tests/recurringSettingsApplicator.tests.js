/**
 * RecurringSettingsApplicator Tests
 * Tests for modules/recurring/recurringSettingsApplicator.js
 *
 * applyRecurringSettings(panel, buildSettingsFromPanel) reads checked recurring
 * checkboxes from the DOM, normalizes the form settings, and writes recurring
 * templates (and task flags) into AppState. These tests inject mock deps via
 * setRecurringSettingsApplicatorDependencies and assert the guard/no-op paths
 * (no active cycle, no cycle data, no checked tasks) and the happy path
 * (template written, defaults applied, panel transitions, watcher restart).
 *
 * NOTE: the module reads DOM via DOM_SELECTORS.RECURRING_CHECK_CHECKED etc. We
 * inject our own querySelectorAll/getElementById mocks so we control the
 * "checked tasks" set without building the real recurring panel markup.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringSettingsApplicatorTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringSettingsApplicator.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringSettingsApplicator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const eq = (a, b, label) => { if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

    // ── Mock builders ─────────────────────────────────────────────────────────

    // In-memory AppState that supports get() and update(producer, immediate).
    function makeAppState(initial) {
        let state = initial;
        return {
            get: () => state,
            update: async (producer) => { producer(state); return state; },
            isReady: () => true
        };
    }

    // A fake checked-checkbox element whose .closest() returns a fake task element.
    function makeCheckbox(taskId, text = 'Task text') {
        const taskEl = {
            dataset: { taskId },
            classList: { add() {} },
            setAttribute() {},
            querySelector: () => ({ textContent: text })
        };
        return {
            checked: true,
            closest: () => taskEl,
            _taskEl: taskEl
        };
    }

    // Build a deps object with sensible defaults; override per test.
    function makeDeps(over = {}) {
        const notifications = [];
        const showNotification = (msg, type, dur) => notifications.push({ msg, type, dur });
        showNotification.calls = notifications;

        const deps = {
            appInit: { waitForCore: async () => {} },
            AppState: over.AppState || makeAppState({ appState: { activeCycleId: 'c1' }, data: { cycles: { c1: { tasks: [], recurringTemplates: {} } } }, settings: {} }),
            showNotification,
            getElementById: () => null, // SET_DEFAULT_RECURRING checkbox absent by default
            querySelectorAll: () => [],  // no checked tasks by default
            normalizeRecurringSettings: (s) => ({ ...s }),
            calculateNextOccurrence: () => 1234567890,
            updateAppState: null, // wired to AppState.update by default below
            syncRecurringStateToDOM: null,
            restartRecurringWatcher: () => { deps._watcherRestarted = true; }
        };
        // Default updateAppState routes to AppState.update
        deps.updateAppState = async (producer) => deps.AppState.update(producer, true);
        Object.assign(deps, over);
        return deps;
    }

    // Minimal panel stub recording method calls.
    function makePanel() {
        const calls = [];
        return {
            calls,
            state: { selectedTaskId: 'pre' },
            updateRecurringSummary: () => calls.push('updateRecurringSummary'),
            setPanelMode: (m) => calls.push('setPanelMode:' + m),
            updateRecurringPanel: async () => calls.push('updateRecurringPanel'),
            updateRecurringPanelButtonVisibility: () => calls.push('updateRecurringPanelButtonVisibility'),
            updateRecurringInfoLink: () => calls.push('updateRecurringInfoLink'),
            clearRecurringForm: () => calls.push('clearRecurringForm'),
            showTaskSummaryPreview: () => calls.push('showTaskSummaryPreview')
        };
    }

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => { if (!mod) throw new Error('Module is falsy'); });

    await test('exports setRecurringSettingsApplicatorDependencies + applyRecurringSettings', () => {
        if (typeof mod.setRecurringSettingsApplicatorDependencies !== 'function') throw new Error('missing setter');
        if (typeof mod.applyRecurringSettings !== 'function') throw new Error('missing applyRecurringSettings');
    });

    // ── Guard / no-op paths ───────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛑 Guards</h4>';

    await test('no active cycle => notifies and does not call updateAppState', async () => {
        let updateCalled = false;
        const deps = makeDeps({
            AppState: makeAppState({ appState: {}, data: { cycles: {} } }),
            updateAppState: async () => { updateCalled = true; }
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        const panel = makePanel();
        await mod.applyRecurringSettings(panel, () => ({ frequency: 'daily' }));
        if (updateCalled) throw new Error('updateAppState should not run without active cycle');
        if (deps.showNotification.calls.length === 0) throw new Error('expected a warning notification');
    });

    await test('active cycle but missing cycle data => notifies, no update', async () => {
        let updateCalled = false;
        const deps = makeDeps({
            AppState: makeAppState({ appState: { activeCycleId: 'ghost' }, data: { cycles: {} } }),
            updateAppState: async () => { updateCalled = true; }
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'daily' }));
        if (updateCalled) throw new Error('updateAppState should not run when cycle data missing');
        if (deps.showNotification.calls.length === 0) throw new Error('expected a notification');
    });

    await test('no checked tasks => notifies and skips update', async () => {
        let updateCalled = false;
        const deps = makeDeps({
            querySelectorAll: () => [], // nothing checked
            updateAppState: async () => { updateCalled = true; }
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'daily' }));
        if (updateCalled) throw new Error('updateAppState should not run with zero checked tasks');
        if (deps.showNotification.calls.length === 0) throw new Error('expected a "no checked" notification');
    });

    // ── Happy path ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Apply Happy Path</h4>';

    await test('writes a recurring template for the checked task', async () => {
        const appState = makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 't1', text: 'Real task' }], recurringTemplates: {} } } },
            settings: {}
        });
        const cb = makeCheckbox('t1', 'DOM text');
        const deps = makeDeps({
            AppState: appState,
            querySelectorAll: (sel) => (sel && sel.includes(':checked')) ? [cb] : [cb]
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'daily', indefinitely: true }));

        const tmpl = appState.get().data.cycles.c1.recurringTemplates.t1;
        if (!tmpl) throw new Error('template t1 was not created');
        eq(tmpl.id, 't1', 'template id');
        eq(tmpl.recurring, true, 'template recurring flag');
        eq(tmpl.text, 'Real task', 'template prefers task.text');
        eq(tmpl.nextScheduledOccurrence, 1234567890, 'next occurrence from calculator');
        eq(tmpl.schemaVersion, 2, 'template schemaVersion');
    });

    await test('marks the matching task as recurring with defaults', async () => {
        const appState = makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 't1', text: 'Real task' }], recurringTemplates: {} } } },
            settings: {}
        });
        const cb = makeCheckbox('t1');
        const deps = makeDeps({ AppState: appState, querySelectorAll: () => [cb] });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'weekly' }));

        const task = appState.get().data.cycles.c1.tasks[0];
        eq(task.recurring, true, 'task.recurring');
        eq(task.schemaVersion, 2, 'task.schemaVersion');
        eq(task.deleteWhenComplete, true, 'task.deleteWhenComplete default');
        if (!task.deleteWhenCompleteSettings) throw new Error('deleteWhenCompleteSettings not set');
        if (!task.recurringSettings) throw new Error('recurringSettings not set on task');
    });

    await test('uses DOM text fallback when task not in task list', async () => {
        const appState = makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [], recurringTemplates: {} } } }, // no matching task
            settings: {}
        });
        const cb = makeCheckbox('orphan', 'Fallback DOM text');
        const deps = makeDeps({ AppState: appState, querySelectorAll: () => [cb] });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'daily' }));

        const tmpl = appState.get().data.cycles.c1.recurringTemplates.orphan;
        if (!tmpl) throw new Error('orphan template not created');
        eq(tmpl.text, 'Fallback DOM text', 'template uses DOM text fallback');
    });

    await test('saveAsDefault checkbox stores defaultRecurringSettings', async () => {
        const appState = makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 't1', text: 'x' }], recurringTemplates: {} } } },
            settings: {}
        });
        const cb = makeCheckbox('t1');
        const deps = makeDeps({
            AppState: appState,
            querySelectorAll: () => [cb],
            getElementById: () => ({ checked: true }) // SET_DEFAULT_RECURRING checked
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'daily' }));

        if (!appState.get().settings.defaultRecurringSettings) {
            throw new Error('defaultRecurringSettings not saved');
        }
    });

    await test('panel transitions to browsing mode and restarts watcher', async () => {
        const appState = makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 't1', text: 'x' }], recurringTemplates: {} } } },
            settings: {}
        });
        const cb = makeCheckbox('t1');
        const deps = makeDeps({ AppState: appState, querySelectorAll: () => [cb] });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        const panel = makePanel();
        await mod.applyRecurringSettings(panel, () => ({ frequency: 'daily' }));

        eq(panel.state.selectedTaskId, null, 'selectedTaskId cleared');
        if (!panel.calls.includes('setPanelMode:browsing')) throw new Error('did not switch to browsing');
        if (!panel.calls.includes('updateRecurringPanel')) throw new Error('did not re-render panel');
        if (!deps._watcherRestarted) throw new Error('watcher not restarted');
    });

    await test('does NOT inject the retired defaultRecurTime field', async () => {
        // defaultRecurTime was retired in v2.358: writers existed but zero
        // readers ever consumed it. The applicator must leave normalized
        // settings untouched instead of re-adding the dead field.
        const appState = makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: [{ id: 't1', text: 'x' }], recurringTemplates: {} } } },
            settings: {}
        });
        const cb = makeCheckbox('t1');
        let capturedSettings = null;
        const deps = makeDeps({
            AppState: appState,
            querySelectorAll: () => [cb],
            normalizeRecurringSettings: (s) => { capturedSettings = { ...s }; return capturedSettings; }
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        await mod.applyRecurringSettings(makePanel(), () => ({ frequency: 'daily' }));
        if (capturedSettings === null) throw new Error('normalize was never called');
        if ('defaultRecurTime' in capturedSettings) throw new Error('retired field must not be injected');
    });

    // ── Error path ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">💥 Error Handling</h4>';

    await test('rethrows after notifying when updateAppState throws', async () => {
        const cb = makeCheckbox('t1');
        const deps = makeDeps({
            AppState: makeAppState({
                appState: { activeCycleId: 'c1' },
                data: { cycles: { c1: { tasks: [{ id: 't1', text: 'x' }], recurringTemplates: {} } } },
                settings: {}
            }),
            querySelectorAll: () => [cb],
            updateAppState: async () => { throw new Error('boom'); }
        });
        mod.setRecurringSettingsApplicatorDependencies(deps);
        const panel = makePanel();
        let threw = false;
        try {
            await mod.applyRecurringSettings(panel, () => ({ frequency: 'daily' }));
        } catch (e) {
            threw = true;
        }
        if (!threw) throw new Error('expected applyRecurringSettings to rethrow');
        // Error path notifies and returns to browsing
        if (!panel.calls.includes('setPanelMode:browsing')) throw new Error('error path did not return to browsing');
        const hadErrorNotify = deps.showNotification.calls.some(c => c.type === 'error');
        if (!hadErrorNotify) throw new Error('error path did not show error notification');
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
