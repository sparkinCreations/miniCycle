/**
 * CycleImportManager Tests
 * Tests for modules/ui/cycleImportManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleImportManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/cycleImportManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>CycleImportManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setCycleImportManagerDependencies is exported as a function', () => {
        if (typeof mod.setCycleImportManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('setupImportButtons is exported as a function', () => {
        if (typeof mod.setupImportButtons !== 'function') throw new Error('Missing export');
    });

    await test('setupDragDropImport is exported as a function', () => {
        if (typeof mod.setupDragDropImport !== 'function') throw new Error('Missing export');
    });

    await test('processImportedData is exported as a function', () => {
        if (typeof mod.processImportedData !== 'function') throw new Error('Missing export');
    });

    await test('initCycleImportManager is exported as a function', () => {
        if (typeof mod.initCycleImportManager !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setCycleImportManagerDependencies accepts an object without throwing', () => {
        mod.setCycleImportManagerDependencies({});
    });

    await test('setCycleImportManagerDependencies accepts mock dependencies', () => {
        mod.setCycleImportManagerDependencies({
            AppState: { get: () => ({ settings: {}, data: { cycles: {} } }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setCycleImportManagerDependencies handles null gracefully', () => {
        try {
            mod.setCycleImportManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    await test('processImportedData rejects invalid JSON with an error notification', async () => {
        let notified = null;
        mod.setCycleImportManagerDependencies({
            AppState: { get: () => ({ settings: {}, data: { cycles: {} } }), update: () => {} },
            showNotification: (msg, type) => { notified = { msg, type }; },
            safeAddEventListener: () => {}
        });

        await mod.processImportedData('not valid json {{{');

        // Invalid JSON is rejected by surfacing an error notification and returning — it
        // must NOT be silently swallowed. The old test accepted BOTH throw and no-throw,
        // so it asserted nothing about the actual rejection behavior.
        if (!notified) {
            throw new Error('invalid JSON should surface a notification, not be swallowed');
        }
        if (notified.type !== 'error') {
            throw new Error(`invalid JSON should notify with type "error", got "${notified.type}"`);
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Behavioral: end-to-end import</h4>';

    // The import path resolves getUniqueCycleName + storage utils via the
    // facade-style dynamic import in initCycleImportManager() — required
    // before processImportedData can complete an import.
    await mod.initCycleImportManager();

    // Drive processImportedData with a real file payload against an in-memory
    // AppState and return the resulting state + notifications. loadMiniCycle
    // MUST be mocked — without it the import falls back to location.reload().
    // mode: 'progress' preserves completed/dueDate; omitting showChoiceModal
    // defaults to 'template' (which resets them by design).
    async function runImport(fileObj, { mode = 'progress', seedCycles = {} } = {}) {
        const state = {
            schemaVersion: '2.5',
            metadata: { createdAt: 1, lastModified: 1, totalCyclesCreated: 0 },
            settings: {},
            data: { cycles: seedCycles },
            appState: { activeCycleId: null },
            userProgress: {}
        };
        const notifications = [];
        mod.setCycleImportManagerDependencies({
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (fn) => { fn(state); },
                reload: () => {}
            },
            showNotification: (msg, type) => notifications.push({ msg, type }),
            safeAddEventListener: () => {},
            loadMiniCycle: () => {},
            showLoader: () => {},
            hideLoader: () => {},
            // Always pass a choice-modal mock: DI setters MERGE, so omitting it
            // would leave a previous test's mock (and its mode) active.
            showChoiceModal: ({ callback }) => callback(mode)
        });
        await mod.processImportedData(JSON.stringify(fileObj));
        return { state, notifications };
    }

    function importedCycle(state) {
        const key = state.appState.activeCycleId;
        if (!key || !state.data.cycles[key]) throw new Error('import did not create/activate a cycle');
        return state.data.cycles[key];
    }

    await test('round-trip: text, completed, dueDate, priority survive a progress-mode import', async () => {
        const { state } = await runImport({
            name: 'RT Routine',
            tasks: [{ id: 't1', text: 'Task A', completed: true, dueDate: '2026-01-15', highPriority: true, priorityColor: '#ff0000' }]
        });
        const cycle = importedCycle(state);
        const t = cycle.tasks[0];
        if (t.text !== 'Task A') throw new Error(`text lost: ${t.text}`);
        if (t.completed !== true) throw new Error('completed flag lost');
        if (t.dueDate !== '2026-01-15') throw new Error(`dueDate lost: ${t.dueDate}`);
        if (t.priorityColor !== '#ff0000') throw new Error(`priorityColor lost: ${t.priorityColor}`);
        if (t.id !== 't1') throw new Error('valid id should round-trip');
    });

    await test('template mode (default) resets completed and dueDate', async () => {
        const { state } = await runImport({
            name: 'Tmpl Routine',
            tasks: [{ id: 't1', text: 'Task A', completed: true, dueDate: '2026-01-15' }]
        }, { mode: 'template' });
        const t = importedCycle(state).tasks[0];
        if (t.completed !== false) throw new Error('template mode must reset completed');
        if (t.dueDate !== null) throw new Error('template mode must reset dueDate');
    });

    await test('hostile task id is regenerated; selector for it does not throw', async () => {
        const { state } = await runImport({
            name: 'Hostile Ids',
            tasks: [{ id: 'ok_id-1.a', text: 'keep' }, { id: 'bad"id]\'', text: 'regen' }]
        });
        const [keep, regen] = importedCycle(state).tasks;
        if (keep.id !== 'ok_id-1.a') throw new Error('safe id should be kept');
        if (regen.id.includes('"') || regen.id.includes(']')) throw new Error('hostile id not regenerated');
        if (!/^task-\d+-1$/.test(regen.id)) throw new Error(`unexpected regenerated id: ${regen.id}`);
        // The original failure mode: a quoted id threw DOMException in querySelector
        document.querySelector(`.task[data-task-id="${CSS.escape(regen.id)}"]`);
    });

    await test('invalid dueDate values are nulled (bad format AND fake calendar date)', async () => {
        const { state } = await runImport({
            name: 'Bad Dates',
            tasks: [
                { id: 'd1', text: 'a', dueDate: 'not-a-date' },
                { id: 'd2', text: 'b', dueDate: '2026-13-45' },
                { id: 'd3', text: 'c', dueDate: '2026-06-15' }
            ]
        });
        const [d1, d2, d3] = importedCycle(state).tasks;
        if (d1.dueDate !== null) throw new Error('malformed dueDate must null');
        if (d2.dueDate !== null) throw new Error('impossible calendar date must null');
        if (d3.dueDate !== '2026-06-15') throw new Error('valid dueDate must survive');
    });

    await test('truthy non-boolean flags coerce to real booleans', async () => {
        const { state } = await runImport({
            name: 'Junk Flags',
            tasks: [{ id: 'j1', text: 'x', completed: 'yes', highPriority: 1, remindersEnabled: 'no', recurring: 'true' }]
        });
        const t = importedCycle(state).tasks[0];
        for (const f of ['completed', 'highPriority', 'remindersEnabled', 'recurring']) {
            if (typeof t[f] !== 'boolean') throw new Error(`${f} must be a boolean, got ${typeof t[f]}`);
            if (t[f] !== false) throw new Error(`${f} truthy-junk must coerce to false (strict === true)`);
        }
    });

    await test('garbage priorityColor on a high-priority task falls back to a valid color', async () => {
        const { state } = await runImport({
            name: 'Bad Color',
            tasks: [{ id: 'c1', text: 'x', highPriority: true, priorityColor: 'javascript:alert(1)' }]
        });
        const t = importedCycle(state).tasks[0];
        if (t.priorityColor === 'javascript:alert(1)') throw new Error('garbage color must not survive');
        if (!/^#[0-9a-fA-F]{3,8}$/.test(t.priorityColor)) throw new Error(`fallback color invalid: ${t.priorityColor}`);
    });

    await test('recurring task gets a rebuilt template keyed by its id', async () => {
        const { state } = await runImport({
            name: 'Recurring',
            tasks: [{ id: 'r1', text: 'Water plants', recurring: true, recurringSettings: { frequency: 'daily', daily: { time: '09:00' } } }]
        });
        const cycle = importedCycle(state);
        const tpl = cycle.recurringTemplates?.['r1'];
        if (!tpl) throw new Error('recurringTemplates must contain an entry keyed by the task id');
        if (tpl.id !== 'r1' || tpl.recurring !== true) throw new Error('template id/recurring wrong');
        if (tpl.text !== 'Water plants') throw new Error('template text must come from the sanitized task');
    });

    await test('imported recurringSettings are normalized; garbage specificDates filtered', async () => {
        const { state } = await runImport({
            name: 'Norm Recurring',
            tasks: [{
                id: 'nr1', text: 'Water plants', recurring: true,
                recurringSettings: {
                    frequency: 'daily',
                    __unknownKey: 'must be dropped',
                    defaultRecurTime: 'vestigial — no reader consumes this',
                    specificDates: { enabled: true, dates: ['2026-06-15', 'garbage-date', '2026-99-99'] }
                }
            }]
        });
        const t = importedCycle(state).tasks[0];
        const rs = t.recurringSettings;
        if ('__unknownKey' in rs || 'defaultRecurTime' in rs) throw new Error('unknown keys must be dropped by normalization');
        if (!('weekly' in rs) || !('monthly' in rs)) throw new Error('normalized shape must be fully enumerated');
        const dates = rs.specificDates.dates;
        if (dates.length !== 1 || dates[0] !== '2026-06-15') throw new Error(`garbage dates must be filtered, got ${JSON.stringify(dates)}`);
        // The rebuilt template must carry the same normalized settings
        const tpl = importedCycle(state).recurringTemplates['nr1'];
        if (!tpl || 'defaultRecurTime' in tpl.recurringSettings) throw new Error('template must be built from normalized settings');
    });

    await test('importing over an existing routine name creates a unique title, not an overwrite', async () => {
        const seeded = { 'My Routine': { id: 'x', title: 'My Routine', tasks: [], recurringTemplates: {} } };
        const { state } = await runImport(
            { name: 'My Routine', tasks: [{ id: 'n1', text: 'new' }] },
            { seedCycles: seeded }
        );
        const key = state.appState.activeCycleId;
        if (key === 'My Routine') throw new Error('collision must not overwrite the existing cycle');
        if (!state.data.cycles['My Routine']) throw new Error('original cycle must survive');
        if (!state.data.cycles[key]) throw new Error('imported cycle missing');
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
