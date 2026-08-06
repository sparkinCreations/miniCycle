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

    // Regression — ARCH REVIEW FINDINGS §1.2 + review F-005: the watcher must commit
    // recreations as a SYSTEM mutation so they never land in undo history. The intent
    // travels WITH the call as { system: true } (the undo wrapper skips its snapshot
    // for that call), replacing the shared isSystemMutation flag — which guarded an
    // await window and could mis-tag an interleaving user update.
    await test('catchUp passes system:true through its commit (review 1.2 / F-005)', async () => {
        let updateCalled = false;
        let optionsSeen = null;
        const as = cycleState({ t1: dueTemplate('t1') }, []);
        mod.setRecurringWatcherDependencies(makeDeps({
            AppState: as,
            updateAppState: async (producer, immediate, options) => {
                updateCalled = true;
                optionsSeen = options;
                return as.update(producer, true);
            }
        }));

        const r = await mod.catchUpMissedRecurringTasks();

        eq(r.added, 1, 'a recreation occurred');
        if (!updateCalled) throw new Error('expected the watcher to commit via updateAppState');
        if (optionsSeen?.system !== true) throw new Error('commit must carry { system: true } so the undo wrapper skips its snapshot');
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

    await test('catchUp blocks spawn when cycle already at task limit — WITHOUT consuming the occurrence', async () => {
        // Boot-review tally correction: a blocked spawn used to advance the
        // template anyway (occurrenceCount++, nextScheduledOccurrence moved
        // on) — the user silently lost the occurrence, and finite-count
        // templates burned toward exhaustion on tasks that never existed.
        const { LIMITS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);
        const limit = LIMITS.TASKS_PER_CYCLE;
        // Fill cycle to the limit with unrelated tasks
        const fullTasks = Array.from({ length: limit }, (_, i) => ({ id: 'x' + i, text: 'x' }));
        const as = cycleState({ t1: dueTemplate('t1') }, fullTasks);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));
        const r = await mod.catchUpMissedRecurringTasks();
        eq(r.added, 0, 'no task added at limit');
        eq(r.blocked, 1, 'one task reported blocked');
        const t = as.get().data.cycles.c1.recurringTemplates.t1;
        eq(t.occurrenceCount, 0, 'blocked spawn must NOT consume an occurrence');
        eq(t.nextScheduledOccurrence, NOW - 1000, 'blocked occurrence stays due for retry');
        eq(r.updated, 0, 'no template update committed for a blocked spawn');
    });

    await test('blocked occurrence is delivered once space frees up', async () => {
        const { LIMITS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);
        const limit = LIMITS.TASKS_PER_CYCLE;
        const fullTasks = Array.from({ length: limit }, (_, i) => ({ id: 'x' + i, text: 'x' }));
        const as = cycleState({ t1: dueTemplate('t1') }, fullTasks);
        mod.setRecurringWatcherDependencies(makeDeps({ AppState: as }));

        await mod.catchUpMissedRecurringTasks();          // blocked
        as.get().data.cycles.c1.tasks.pop();              // user deletes a task
        const r2 = await mod.catchUpMissedRecurringTasks();
        eq(r2.added, 1, 'previously blocked occurrence delivered');
        eq(as.get().data.cycles.c1.recurringTemplates.t1.occurrenceCount, 1, 'occurrence consumed on actual delivery');
    });

    await test('task-limit notification fires once per blocked era, resets on successful spawn', async () => {
        const { LIMITS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);
        const limit = LIMITS.TASKS_PER_CYCLE;
        const fullTasks = Array.from({ length: limit }, (_, i) => ({ id: 'x' + i, text: 'x' }));
        const as = cycleState({ t1: dueTemplate('t1') }, fullTasks);
        const limitMessages = [];
        mod.resetWatcherState();
        mod.setRecurringWatcherDependencies(makeDeps({
            AppState: as,
            showNotification: (msg, type) => { if (type === 'warning') limitMessages.push(msg); }
        }));

        await mod.catchUpMissedRecurringTasks();  // blocked → notifies
        await mod.catchUpMissedRecurringTasks();  // still blocked → once-per-era guard mutes
        eq(limitMessages.length, 1, 'repeat block in the same era must not re-notify');

        as.get().data.cycles.c1.tasks.pop();      // space frees
        await mod.catchUpMissedRecurringTasks();  // delivered → era resets
        // Simulate the next occurrence coming due after the user completed the
        // spawned task (instance auto-deletes) and the cycle refilled to the
        // limit — a NEW block must notify again.
        const cyc = as.get().data.cycles.c1;
        cyc.tasks = cyc.tasks.filter(t => t.id !== 't1');
        cyc.tasks.push({ id: 'y', text: 'y' });
        cyc.recurringTemplates.t1.nextScheduledOccurrence = NOW - 500;
        await mod.catchUpMissedRecurringTasks();
        eq(limitMessages.length, 2, 'new blocked era after a successful spawn notifies again');
        mod.resetWatcherState();
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

    // ── End-date semantics (recurring review Findings A & B) ─────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧟 End-date resurrection loop (Finding A)</h4>';

    // Wire the REAL calculator so the test exercises the actual
    // catch-up → spawn → recalculate loop, not a mock's answer.
    const calcMod = await import(`../modules/recurring/recurringCalculators.js?v=${cacheBuster}`);
    const dateUtils = await import(`../modules/recurring/recurringDateUtils.js?v=${cacheBuster}`);
    calcMod.setDateUtils(dateUtils);
    calcMod.setNormalizer((s) => s);

    await test('catchUp delivers the final owed pre-end occurrence, then STOPS (no zombie)', async () => {
        // Routine ended Aug 9; the Aug 9 occurrence came due but the user never
        // opened the app. Opening on Aug 10: that one is still owed and must
        // spawn — but the template must then be finished, not rescheduled past
        // the end date.
        const now = new Date(2026, 7, 10, 12, 0, 0).getTime();       // Aug 10, noon
        const owed = new Date(2026, 7, 9, 9, 0, 0).getTime();        // Aug 9, 9:00 — pre-end
        const template = {
            id: 't1', text: 'T-t1',
            nextScheduledOccurrence: owed,
            occurrenceCount: 3,
            recurringSettings: { frequency: 'daily', indefinitely: false, untilDate: '2026-08-09' }
        };
        const as = cycleState({ t1: template }, []);
        mod.setRecurringWatcherDependencies(makeDeps({
            AppState: as,
            now: () => now,
            calculateNextOccurrence: calcMod.calculateNextOccurrence
        }));

        // Session 1: the owed final occurrence spawns — correct.
        const r1 = await mod.catchUpMissedRecurringTasks();
        eq(r1.added, 1, 'final owed occurrence delivered');
        const t = as.get().data.cycles.c1.recurringTemplates.t1;
        eq(t.nextScheduledOccurrence, null, 'template finished — nothing scheduled past the end date');

        // User completes the task (recreated instances auto-delete on completion).
        as.get().data.cycles.c1.tasks.length = 0;

        // Session 2: nothing is owed anymore — the routine ended.
        const r2 = await mod.catchUpMissedRecurringTasks();
        eq(r2.added, 0, 'no zombie respawn after the routine ended');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">😴 Oversleep gap (Finding B)</h4>';

    await test('watch delivers a spawn missed during device sleep despite pattern mismatch', async () => {
        // Lid closed at 8:58, scheduled for 9:00, wake at 9:20: polls resume but
        // the exact-minute pattern check answers "no" until tomorrow, and a
        // visible→visible sleep fires no visibilitychange to trigger catch-up.
        // An oversleeping watcher must fall back to trusting the timestamp.
        let clock = NOW;
        const template = dueTemplate('t1', { nextScheduledOccurrence: NOW + 120_000 }); // due at +2min
        const as = cycleState({ t1: template }, []);
        mod.resetWatcherState();
        mod.setRecurringWatcherDependencies(makeDeps({
            AppState: as,
            now: () => clock,
            shouldRecreateRecurringTask: () => false // "is it 9:00 right now?" → no
        }));

        await mod.watchRecurringTasks();             // normal tick — nothing due yet
        eq(as.get().data.cycles.c1.tasks.length, 0, 'nothing due at first tick');

        clock = NOW + 20 * 60_000;                   // wake 20 minutes later
        await mod.watchRecurringTasks();             // overslept tick
        eq(as.get().data.cycles.c1.tasks.length, 1, 'missed occurrence delivered on wake');
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
