/**
 * RecurringWatcher Tests
 * Tests for modules/recurring/recurringWatcher.js
 *
 * The watcher periodically spawns recurring tasks from templates that are due,
 * catches up on missed occurrences, enforces a per-cycle task limit, and tracks
 * finite repeat counts (occurrenceCount vs settings.count). All external effects
 * are injected (AppState, updateAppState, now, calculateNextOccurrence,
 * shouldRecreateRecurringTask, setInterval/clearInterval, isEnabled), so these
 * tests drive real behavior without the live app or timers.
 *
 * Isolation: resetWatcherState() is called before each test that touches the
 * setup/interval singleton state.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringWatcherTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringWatcher.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringWatcher Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const eq = (a, b, label) => { if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

    const NOW = 1_000_000_000; // fixed clock for determinism

    // In-memory AppState
    function makeAppState(initial) {
        let state = initial;
        return {
            get: () => state,
            update: async (producer) => { producer(state); return state; },
            isReady: () => true
        };
    }

    // Build deps; override per test. updateAppState routes to AppState.update.
    function makeDeps(over = {}) {
        const deps = {
            appInit: { waitForCore: async () => {} },
            isEnabled: () => true,
            now: () => NOW,
            calculateNextOccurrence: () => NOW + 60000, // 1 min later
            shouldRecreateRecurringTask: () => true,    // pattern always matches (slow path)
            showNotification: () => {},
            refreshUIFromState: null,
            setInterval: (fn, ms) => ({ fn, ms, _id: Symbol('iv') }),
            clearInterval: () => {},
            AppState: over.AppState || makeAppState(null)
        };
        deps.updateAppState = async (producer) => deps.AppState.update(producer, true);
        Object.assign(deps, over);
        return deps;
    }

    function cycleState(templates = {}, tasks = []) {
        return makeAppState({
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks, recurringTemplates: templates } } }
        });
    }

    // A due template (nextScheduledOccurrence in the past relative to NOW).
    function dueTemplate(id, extra = {}) {
        return {
            id,
            text: 'T-' + id,
            nextScheduledOccurrence: NOW - 1000,
            occurrenceCount: 0,
            recurringSettings: { frequency: 'daily', indefinitely: true },
            ...extra
        };
    }

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => { if (!mod) throw new Error('Module is falsy'); });

    await test('exports the expected functions', () => {
        ['setRecurringWatcherDependencies', 'restartRecurringWatcher', 'catchUpMissedRecurringTasks',
         'watchRecurringTasks', 'setupRecurringWatcher', 'isWatcherInitialized', 'resetWatcherState']
            .forEach(fn => { if (typeof mod[fn] !== 'function') throw new Error('missing ' + fn); });
    });

    await test('isWatcherInitialized returns a boolean', () => {
        mod.resetWatcherState();
        if (typeof mod.isWatcherInitialized() !== 'boolean') throw new Error('not boolean');
    });

    // ── Feature-flag / guard paths ────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛑 Guards</h4>';

    await test('catchUp returns zeros when feature disabled', async () => {
        mod.setRecurringWatcherDependencies(makeDeps({ isEnabled: () => false }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'added'); eq(r.updated, 0, 'updated');
    });

    await test('catchUp returns zeros when AppState.get is unavailable', async () => {
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: { /* no get */ } }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'added');
    });

    await test('catchUp returns zeros when no active cycle', async () => {
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: makeAppState({ appState: {}, data: { cycles: {} } }) }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'added');
    });

    await test('catchUp returns zeros when no templates exist', async () => {
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: cycleState({}, []) }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'added'); eq(r.updated, 0, 'updated');
    });

    await test('watchRecurringTasks is a no-op (no throw) when feature disabled', async () => {
        mod.setRecurringWatcherDependencies(makeDeps({ isEnabled: () => false }));
        await mod.watchRecurringTasks(); // must not throw
    });

    // ── Catch-up spawning ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⏰ Catch-up Spawning</h4>';

    await test('catchUp adds a task for a due template and increments occurrenceCount', async () => {
        const as = cycleState({ t1: dueTemplate('t1') }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 1, 'added one');
        const cyc = as.get().data.cycles.c1;
        eq(cyc.tasks.length, 1, 'task pushed');
        eq(cyc.tasks[0].id, 't1', 'task id');
        eq(cyc.tasks[0].deleteWhenComplete, true, 'recreated instance forced deleteWhenComplete=true');
        eq(cyc.recurringTemplates.t1.occurrenceCount, 1, 'occurrenceCount incremented');
        eq(cyc.recurringTemplates.t1.nextScheduledOccurrence, NOW + 60000, 'next occurrence advanced');
    });

    await test('catchUp skips template when matching task already exists', async () => {
        const as = cycleState({ t1: dueTemplate('t1') }, [{ id: 't1', text: 'existing' }]);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'nothing added');
        eq(as.get().data.cycles.c1.tasks.length, 1, 'task count unchanged');
    });

    await test('catchUp skips template with null nextScheduledOccurrence', async () => {
        const as = cycleState({ t1: dueTemplate('t1', { nextScheduledOccurrence: null }) }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'nothing added for finished template');
    });

    await test('catchUp skips template not yet due (future occurrence)', async () => {
        const as = cycleState({ t1: dueTemplate('t1', { nextScheduledOccurrence: NOW + 999999 }) }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'future template not spawned');
    });

    await test('catchUp adds only ONE task even if many occurrences were missed', async () => {
        // way-overdue template; watcher policy = one task per template regardless of misses
        const as = cycleState({ t1: dueTemplate('t1', { nextScheduledOccurrence: NOW - 999_999_999 }) }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 1, 'exactly one task for many misses');
    });

    // Regression — ARCH REVIEW FINDINGS §1.2: the watcher must commit recreations as a
    // SYSTEM mutation so they never land in undo history. Verify it raises
    // AppGlobalState.isSystemMutation during the commit and clears it afterward (the undo
    // wrapper's captureStateSnapshot skips capture while that flag is set).
    await test('catchUp raises/clears isSystemMutation around its commit (review 1.2)', async () => {
        const AppGlobalState = { isSystemMutation: false };
        let flagDuringUpdate = null;
        let updateCalled = false;
        const as = cycleState({ t1: dueTemplate('t1') }, []);
        mod.setRecurringWatcherDependencies(makeDeps({
            AppState: as,
            AppGlobalState,
            updateAppState: async (producer) => {
                updateCalled = true;
                flagDuringUpdate = AppGlobalState.isSystemMutation; // must be TRUE mid-commit
                return as.update(producer, true);
            }
        }));

        const r = await mod.catchUpMissedRecurringTasks();

        eq(r.added, 1, 'a recreation occurred');
        if (!updateCalled) throw new Error('expected the watcher to commit via updateAppState');
        if (flagDuringUpdate !== true) throw new Error('isSystemMutation must be TRUE during the watcher commit');
        if (AppGlobalState.isSystemMutation !== false) throw new Error('isSystemMutation must be cleared after the commit');
    });

    // ── Count enforcement ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Count Enforcement</h4>';

    await test('finite count: occurrenceCount at limit is skipped (exhausted)', async () => {
        const tmpl = dueTemplate('t1', {
            occurrenceCount: 3,
            recurringSettings: { frequency: 'daily', indefinitely: false, count: 3 }
        });
        const as = cycleState({ t1: tmpl }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'exhausted template not spawned');
    });

    await test('finite count: final spawn nullifies nextScheduledOccurrence', async () => {
        // count=2, occurrenceCount=1 → this spawn makes it 2 → exhausted → next = null
        const tmpl = dueTemplate('t1', {
            occurrenceCount: 1,
            recurringSettings: { frequency: 'daily', indefinitely: false, count: 2 }
        });
        const as = cycleState({ t1: tmpl }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 1, 'final occurrence spawned');
        eq(as.get().data.cycles.c1.recurringTemplates.t1.occurrenceCount, 2, 'count reached');
        eq(as.get().data.cycles.c1.recurringTemplates.t1.nextScheduledOccurrence, null, 'no further occurrences');
    });

    await test('finite count: non-final spawn keeps a next occurrence', async () => {
        const tmpl = dueTemplate('t1', {
            occurrenceCount: 0,
            recurringSettings: { frequency: 'daily', indefinitely: false, count: 5 }
        });
        const as = cycleState({ t1: tmpl }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        await mod.catchUpMissedRecurringTasks();
        eq(as.get().data.cycles.c1.recurringTemplates.t1.nextScheduledOccurrence, NOW + 60000, 'next occurrence kept');
    });

    // ── watchRecurringTasks (slow-path matcher) ───────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ watchRecurringTasks</h4>';

    await test('watch spawns when shouldRecreateRecurringTask returns true', async () => {
        const as = cycleState({ t1: dueTemplate('t1') }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as, shouldRecreateRecurringTask: () => true }));
        await mod.watchRecurringTasks();
        eq(as.get().data.cycles.c1.tasks.length, 1, 'watch spawned task');
    });

    await test('watch does NOT spawn when shouldRecreateRecurringTask returns false', async () => {
        const as = cycleState({ t1: dueTemplate('t1') }, []);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as, shouldRecreateRecurringTask: () => false }));
        await mod.watchRecurringTasks();
        eq(as.get().data.cycles.c1.tasks.length, 0, 'pattern mismatch blocks spawn');
    });

    // ── Task limit enforcement ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🚧 Task Limit</h4>';

    await test('catchUp blocks spawn when cycle already at task limit', async () => {
        const { LIMITS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);
        const limit = LIMITS.TASKS_PER_CYCLE;
        // Fill cycle to the limit with unrelated tasks
        const fullTasks = Array.from({ length: limit }, (_, i) => ({ id: 'x' + i, text: 'x' }));
        const as = cycleState({ t1: dueTemplate('t1') }, fullTasks);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'no task added at limit');
        eq(r.blocked, 1, 'one task reported blocked');
        // template timestamps still update even though task was blocked
        eq(as.get().data.cycles.c1.recurringTemplates.t1.occurrenceCount, 1, 'template still advanced');
    });

    // ── Interval / setup state ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Setup & Intervals</h4>';

    await test('setupRecurringWatcher marks initialized and is idempotent', async () => {
        mod.resetWatcherState();
        let setIntervalCalls = 0;
        const deps = makeDeps({
            AppState: cycleState({ t1: dueTemplate('t1') }, []),
            setInterval: (fn, ms) => { setIntervalCalls++; return { fn, ms }; }
        });
        mod.setRecurringWatcherDependencies(deps);
        await mod.setupRecurringWatcher();
        eq(mod.isWatcherInitialized(), true, 'initialized after setup');
        const after = setIntervalCalls;
        await mod.setupRecurringWatcher(); // second call should early-return
        eq(setIntervalCalls, after, 'idempotent: no extra setInterval on re-setup');
        mod.resetWatcherState();
    });

    await test('setup does not initialize when feature disabled', async () => {
        mod.resetWatcherState();
        mod.setRecurringWatcherDependencies(makeDeps({ isEnabled: () => false }));
        await mod.setupRecurringWatcher();
        eq(mod.isWatcherInitialized(), false, 'not initialized when disabled');
    });

    await test('resetWatcherState clears initialized flag and clears interval', async () => {
        mod.resetWatcherState();
        let cleared = false;
        const deps = makeDeps({
            AppState: cycleState({ t1: dueTemplate('t1') }, []),
            setInterval: (fn, ms) => ({ fn, ms }),
            clearInterval: () => { cleared = true; }
        });
        mod.setRecurringWatcherDependencies(deps);
        await mod.setupRecurringWatcher();
        eq(mod.isWatcherInitialized(), true, 'initialized');
        mod.resetWatcherState();
        eq(mod.isWatcherInitialized(), false, 'reset clears flag');
        if (!cleared) throw new Error('resetWatcherState did not clear the interval');
    });

    await test('restartRecurringWatcher is a no-op when not initialized', async () => {
        mod.resetWatcherState();
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: cycleState({ t1: dueTemplate('t1') }, []) }));
        // Should not throw and should not spawn (watcher not set up)
        mod.restartRecurringWatcher();
        // not initialized → restart returns before running a check
        eq(mod.isWatcherInitialized(), false, 'still uninitialized');
    });

    // cleanup global singleton state
    mod.resetWatcherState();

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
