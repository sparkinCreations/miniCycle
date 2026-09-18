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
            AppState: { get: () => ({ settings: {}, data: { routine: {} } }), update: () => {} },
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
            AppState: { get: () => ({ settings: {}, data: { routine: {} } }), update: () => {} },
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
            schemaVersion: '2.6',
            metadata: { createdAt: 1, lastModified: 1, totalRoutinesCreated: 0 },
            settings: {},
            data: { routine: seedCycles },
            appState: { activeRoutineId: null },
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
        const key = state.appState.activeRoutineId;
        if (!key || !state.data.routine[key]) throw new Error('import did not create/activate a cycle');
        return state.data.routine[key];
    }

    await test('round-trip: text, completed, dueDate, priority survive a progress-mode import', async () => {
        const { state } = await runImport({
            name: 'RT Routine',
            tasks: [{ id: 't1', text: 'Task A', completed: true, dueDate: '2026-01-15', priority: 'high' }]
        });
        const cycle = importedCycle(state);
        const t = cycle.tasks[0];
        if (t.text !== 'Task A') throw new Error(`text lost: ${t.text}`);
        if (t.completed !== true) throw new Error('completed flag lost');
        if (t.dueDate !== '2026-01-15') throw new Error(`dueDate lost: ${t.dueDate}`);
        if (t.priority !== 'high') throw new Error(`priority lost: ${t.priority}`);
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
        for (const f of ['completed', 'remindersEnabled', 'recurring']) {
            if (typeof t[f] !== 'boolean') throw new Error(`${f} must be a boolean, got ${typeof t[f]}`);
            if (t[f] !== false) throw new Error(`${f} truthy-junk must coerce to false (strict === true)`);
        }
        if (t.priority !== null) throw new Error(`highPriority: 1 is not a flag — expected no priority, got ${t.priority}`);
        if ('highPriority' in t) throw new Error('the 2.5 flag must not be stored');
    });

    await test('garbage priorityColor on a 2.5 high-priority task reads as High and is not stored', async () => {
        const { state } = await runImport({
            name: 'Bad Color',
            tasks: [{ id: 'c1', text: 'x', highPriority: true, priorityColor: 'javascript:alert(1)' }]
        });
        const t = importedCycle(state).tasks[0];
        if (t.priority !== 'high') throw new Error(`flagged with an unusable colour should be High, got ${t.priority}`);
        if ('priorityColor' in t) throw new Error('no colour may be stored, least of all a garbage one');
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

    // ── delete-when-complete: the canonical per-mode map ───────────────────
    // Two fields describe one behaviour. `autoClear {cycle,
    // todo}` is the durable truth; `deleteWhenComplete` is a flat mirror that
    // cycleMode.js calls a "legacy/transitional mirror" and the public .mcyc
    // schema marks "DERIVED, so do not author this".
    //
    // MEASURED (Aug 2026): a shared file omitting both — the shape the schema
    // tells authors to write — imports with the mirror at `true` and
    // settings.cycle at `false`, i.e. they DISAGREE on arrival. That is not a
    // bug, because boot re-derives the mirror from the map and writes the
    // corrected value back before the user can act on it; the journey test
    // "an imported task's keep-on-reset setting is honoured" pins that
    // reconciliation and the survival that depends on it.
    // So what is worth asserting HERE is the field that is actually durable:
    // the per-mode map must be right, because every reconciliation reads it.
    await test('import derives per-mode delete settings for a plain task', async () => {
        const { state } = await runImport({
            name: 'Delete Settings',
            tasks: [{ id: 't1', text: 'Keep me on reset' }]   // omits BOTH delete fields
        });
        const cycle = importedCycle(state);
        const t = cycle.tasks[0];

        if (cycle.deleteCheckedTasks === true) {
            throw new Error('precondition: import produced a to-do-mode routine, so settings.cycle no longer governs');
        }
        const st = t.autoClear;
        if (!st || typeof st.cycle !== 'boolean' || typeof st.todo !== 'boolean') {
            throw new Error(`import must always produce a complete per-mode map, got ${JSON.stringify(st)}`);
        }
        // Non-recurring default: keep on a cycle reset, clear in to-do mode.
        if (st.cycle !== false || st.todo !== true) {
            throw new Error(`non-recurring default should be {cycle:false, todo:true}, got ${JSON.stringify(st)}`);
        }
    });

    await test('import derives per-mode delete settings for a recurring task', async () => {
        // Recurring tasks default the other way — always delete — because the
        // template re-creates them. A regression here silently changes whether
        // shared recurring routines accumulate duplicates.
        const { state } = await runImport({
            name: 'Recurring Delete Settings',
            tasks: [{ id: 't1', text: 'Daily', recurring: true }]
        });
        const st = importedCycle(state).tasks[0].autoClear;
        if (!st || st.cycle !== true || st.todo !== true) {
            throw new Error(`recurring default should be {cycle:true, todo:true}, got ${JSON.stringify(st)}`);
        }
    });

    // ── 2.6 file fields (read ahead of the format bump; SCHEMA_2_6_PLAN.md ".mcyc") ──
    // One test per alias, so a future cleanup that drops one fails loudly.
    resultsDiv.innerHTML += '<h4 class="test-section">🔜 2.6 file aliases</h4>';
    const { DEFAULT_PRIORITY_SWATCHES } = await import(`../modules/core/constants.js?v=${cacheBuster}`);
    const defaultSwatch = (level) => DEFAULT_PRIORITY_SWATCHES.find(s => s.level === level).hex;

    await test('a task\'s `autoClear` map imports as stored, and wins over the 2.5 map', async () => {
        const { state } = await runImport({
            name: 'autoClear alias',
            tasks: [
                { id: 't1', text: 'Only 2.6', autoClear: { cycle: true, todo: false } },
                { id: 't2', text: 'Both', autoClear: { cycle: true, todo: false }, deleteWhenCompleteSettings: { cycle: false, todo: true } }
            ]
        });
        const [t1, t2] = importedCycle(state).tasks;
        if (t1.autoClear.cycle !== true || t1.autoClear.todo !== false) {
            throw new Error(`autoClear not read: ${JSON.stringify(t1.autoClear)}`);
        }
        if (t2.autoClear.cycle !== true || t2.autoClear.todo !== false) {
            throw new Error(`2.6 map should win: ${JSON.stringify(t2.autoClear)}`);
        }
        if ('deleteWhenCompleteSettings' in t1 || 'deleteWhenComplete' in t1) throw new Error('the 2.5 pair must not be stored');
    });

    await test('a task\'s `priority` level imports as stored, and wins over the 2.5 pair', async () => {
        const { state } = await runImport({
            name: 'priority alias',
            tasks: [
                { id: 't1', text: 'Medium', priority: 'medium' },
                { id: 't2', text: 'Off wins', priority: null, highPriority: true, priorityColor: '#ff0000' },
                { id: 't3', text: 'Unknown level falls to 2.5', priority: 'urgent', highPriority: true, priorityColor: '#00ff00' },
                { id: 't4', text: '2.5 only', highPriority: true, priorityColor: '#facc15' }
            ]
        });
        const [t1, t2, t3, t4] = importedCycle(state).tasks;
        if (t1.priority !== 'medium') throw new Error(`medium → ${t1.priority}`);
        if (t2.priority !== null) throw new Error(`priority:null should turn it off, got ${JSON.stringify(t2)}`);
        if (t3.priority !== 'low') throw new Error(`unknown level should fall back to the 2.5 pair (green → low), got ${t3.priority}`);
        if (t4.priority !== 'medium') throw new Error(`a 2.5 colour names its level, got ${t4.priority}`);
        if ('highPriority' in t1 || 'priorityColor' in t1) throw new Error('the 2.5 pair must not be stored');
    });

    await test('an orphan recurring template\'s `priority` level imports as stored', async () => {
        const { state } = await runImport({
            name: 'orphan priority alias',
            tasks: [],
            recurringTemplates: {
                'tpl-1': { id: 'tpl-1', text: 'Weekly', priority: 'low', recurringSettings: { frequency: 'weekly' } }
            }
        });
        const tpl = Object.values(importedCycle(state).recurringTemplates || {})[0];
        if (!tpl) throw new Error('orphan template was not imported');
        if (tpl.priority !== 'low') throw new Error(`low → ${tpl.priority}`);
    });

    await test('a cleared entry\'s `priority` and `autoClear` import as stored; a 2.5 entry\'s flag maps to a level', async () => {
        const { state } = await runImport({
            name: 'cleared entry aliases',
            tasks: [],
            clearedTasks: { entries: [
                { taskText: 'Gone', clearedAt: 5, priority: 'high', autoClear: { cycle: false, todo: false } },
                { taskText: 'Gone too', clearedAt: 6, priority: null, wasHighPriority: true, priorityColor: '#ff0000' },
                { taskText: 'Old', clearedAt: 7, wasHighPriority: true, priorityColor: '#facc15' }
            ] }
        });
        const entries = importedCycle(state).clearedTasks?.entries || [];
        if (entries.length !== 3) throw new Error(`expected 3 entries, got ${entries.length}`);
        const [a, b, c] = entries;
        if (a.priority !== 'high') throw new Error(`high → ${a.priority}`);
        if (c.priority !== 'medium') throw new Error(`a 2.5 entry's colour names its level, got ${c.priority}`);
        if ('wasHighPriority' in a || 'priorityColor' in c) throw new Error('the 2.5 entry fields must not be stored');
        if (!a.autoClear || a.autoClear.cycle !== false || a.autoClear.todo !== false) {
            throw new Error(`autoClear not read: ${JSON.stringify(a.autoClear)}`);
        }
        if (b.priority !== null) throw new Error(`priority:null should win over the 2.5 pair, got ${JSON.stringify(b)}`);
    });

    await test('a history event\'s `priority` level imports as stored; a 2.5 colour maps to its level', async () => {
        const { state } = await runImport({
            name: 'history priority alias',
            tasks: [],
            history: { events: [
                { type: 'task_priority_set', timestamp: 1, details: { taskName: 'x', priority: 'medium' } },
                { type: 'task_priority_set', timestamp: 2, details: { taskName: 'y', priorityColor: '#28a745' } }
            ] }
        });
        const events = importedCycle(state).history?.events || [];
        if (events.length !== 2) throw new Error('history events were not imported');
        if (events[0].details.priority !== 'medium') throw new Error(`got ${JSON.stringify(events[0].details)}`);
        if (events[1].details.priority !== 'low' || 'priorityColor' in events[1].details) throw new Error(`2.5 colour → ${JSON.stringify(events[1].details)}`);
    });

    await test('an explicit per-mode map in the file is preserved, not overwritten by defaults', async () => {
        const { state } = await runImport({
            name: 'Explicit Delete Settings',
            tasks: [{ id: 't1', text: 'Task', autoClear: { cycle: true, todo: false } }]
        });
        const st = importedCycle(state).tasks[0].autoClear;
        if (st.cycle !== true || st.todo !== false) {
            throw new Error(`author's explicit settings lost: ${JSON.stringify(st)}`);
        }
    });

    await test('importing over an existing routine name creates a unique title, not an overwrite', async () => {
        const seeded = { 'My Routine': { id: 'x', title: 'My Routine', tasks: [], recurringTemplates: {} } };
        const { state } = await runImport(
            { name: 'My Routine', tasks: [{ id: 'n1', text: 'new' }] },
            { seedCycles: seeded }
        );
        const key = state.appState.activeRoutineId;
        if (key === 'My Routine') throw new Error('collision must not overwrite the existing cycle');
        if (!state.data.routine['My Routine']) throw new Error('original cycle must survive');
        if (!state.data.routine[key]) throw new Error('imported cycle missing');
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
