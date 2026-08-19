/**
 * dailyResetManager Tests
 *
 * Covers the catch-up + idempotency logic for the per-routine
 * "Auto-uncheck Daily" feature. The fire path must be:
 *   - Atomic (single AppState.update producer)
 *   - Idempotent within a calendar day (lastResetDate guard)
 *   - Local-timezone correct (YYYY-MM-DD vs UTC)
 *   - Multi-routine (iterates ALL cycles, not just active)
 *   - Silent in state for inactive cycles (pendingNotification deferred)
 *   - Immediate notification + DOM uncheck for the active cycle
 */

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

const cacheBuster = `?v=${Date.now()}`;

export async function runDailyResetManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>dailyResetManager Tests</h2><h3>Setting up mocks...</h3>';

    await setupTestEnvironment();

    const {
        DailyResetManager,
        setDailyResetManagerDependencies,
        __test__
    } = await import(`../modules/task/dailyResetManager.js${cacheBuster}`);

    const { todayLocal, localTimeToday, formatTime12, formatTimeInput, readSettings } = __test__;

    const { getLabel } = await import(`../modules/labels/labelResolver.js${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>dailyResetManager Tests</h2><h3>Running tests...</h3>';

    const passed = { count: 0 };
    const total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // =========================================================
    // Helper to build a fresh manager with a controllable mock state
    // =========================================================
    function makeMockState({ activeCycleId = 'morning', cycles = {} } = {}) {
        return {
            data: { cycles },
            appState: { activeCycleId },
            settings: {},
            metadata: { version: '2.5' }
        };
    }

    /**
     * Run `fn` with the clock frozen at a fixed LOCAL time on a fixed date.
     *
     * The manager reads real wall-clock time (no injectable clock), so the
     * "trigger time is in the future" and "has already passed" cases were
     * whichever the current hour happened to make them. The future-time test
     * papered over it by RETURNING early between 23:58 and midnight — which
     * counts as a pass while asserting nothing, and test:meta cannot see a
     * conditional early return.
     *
     * Freezing at midday makes 23:59 unambiguously future and 00:00
     * unambiguously past, in every timezone and at every hour of the day.
     */
    async function withFrozenClock(hour, minute, fn) {
        const RealDate = Date;
        const frozen = new RealDate(2026, 5, 15, hour, minute, 0, 0);   // 15 Jun 2026, local
        globalThis.Date = class extends RealDate {
            constructor(...args) {
                if (args.length === 0) super(frozen.getTime());
                else super(...args);
            }
            static now() { return frozen.getTime(); }
        };
        globalThis.Date.parse = RealDate.parse;
        globalThis.Date.UTC = RealDate.UTC;
        try { return await fn(); } finally { globalThis.Date = RealDate; }
    }

    function makeManager({ state, onUpdate = null, onNotify = null, onGetById = null } = {}) {
        let internalState = state || makeMockState();
        const updates = [];
        const notifications = [];

        setDailyResetManagerDependencies({
            AppState: {
                get: () => internalState,
                update: (fn, immediate) => {
                    fn(internalState);
                    updates.push({ immediate });
                    onUpdate?.(internalState);
                },
                subscribe: () => {},
                unsubscribe: () => {}
            },
            showNotification: (msg, type, dur, opts) => {
                notifications.push({ msg, type, dur, opts });
                onNotify?.({ msg, type });
            },
            getElementById: onGetById || (() => null),
            getBody: () => document.body
        });

        const m = new DailyResetManager();
        return { manager: m, getState: () => internalState, updates, notifications };
    }

    // =========================================================
    // 🧮 PURE HELPERS
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧮 Pure Helpers</h4>';

    await test('todayLocal returns YYYY-MM-DD', () => {
        const result = todayLocal(new Date(2026, 3, 24, 14, 30)); // April 24
        if (result !== '2026-04-24') throw new Error(`Got ${result}`);
    });

    await test('todayLocal pads single-digit month/day', () => {
        const result = todayLocal(new Date(2026, 0, 5));
        if (result !== '2026-01-05') throw new Error(`Got ${result}`);
    });

    await test('localTimeToday returns timestamp for HH:MM today', () => {
        const now = new Date(2026, 3, 24, 14, 30);
        const ts = localTimeToday(0, 0, now);
        const midnight = new Date(2026, 3, 24, 0, 0, 0, 0).getTime();
        if (ts !== midnight) throw new Error(`Expected ${midnight}, got ${ts}`);
    });

    await test('formatTime12 handles midnight as 12:00 AM', () => {
        if (formatTime12(0, 0) !== '12:00 AM') throw new Error(formatTime12(0, 0));
    });

    await test('formatTime12 handles noon as 12:00 PM', () => {
        if (formatTime12(12, 0) !== '12:00 PM') throw new Error(formatTime12(12, 0));
    });

    await test('formatTime12 handles 6:30 PM', () => {
        if (formatTime12(18, 30) !== '6:30 PM') throw new Error(formatTime12(18, 30));
    });

    await test('formatTimeInput pads to HH:MM', () => {
        if (formatTimeInput(6, 5) !== '06:05') throw new Error(formatTimeInput(6, 5));
        if (formatTimeInput(0, 0) !== '00:00') throw new Error(formatTimeInput(0, 0));
    });

    await test('readSettings returns safe defaults for missing field', () => {
        const s = readSettings({});
        if (s.enabled !== false || s.hour !== 0 || s.minute !== 0 || s.lastResetDate !== null || s.pendingNotification !== false) {
            throw new Error(`Defaults wrong: ${JSON.stringify(s)}`);
        }
    });

    await test('readSettings preserves valid settings', () => {
        const s = readSettings({ autoUncheckDaily: { enabled: true, hour: 6, minute: 30, lastResetDate: '2026-04-24', pendingNotification: true } });
        if (s.hour !== 6 || s.minute !== 30 || !s.enabled || s.lastResetDate !== '2026-04-24' || !s.pendingNotification) {
            throw new Error(JSON.stringify(s));
        }
    });

    // =========================================================
    // 🔁 CHECK / FIRE LOGIC
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 checkAllRoutines</h4>';

    await test('Disabled routine never fires', async () => {
        const cycles = {
            a: { tasks: [{ completed: true }, { completed: true }], autoUncheckDaily: { enabled: false, hour: 0, minute: 0 } }
        };
        const { manager, getState, updates } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        await manager.checkAllRoutines();
        if (updates.length !== 0) throw new Error('Should not have updated state');
        if (!getState().data.cycles.a.tasks[0].completed) throw new Error('Task should remain checked');
    });

    await test('Enabled routine with future trigger time does not fire', async () => {
        const cycles = {
            a: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: true, hour: 23, minute: 59 } }
        };
        // Frozen at midday, so 23:59 is future no matter when this actually runs.
        await withFrozenClock(12, 0, async () => {
            const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
            await manager.checkAllRoutines();
            if (!getState().data.cycles.a.tasks[0].completed) throw new Error('Should not have unchecked future-time routine');
        });
    });

    await test('Enabled routine fires when trigger time has passed today', async () => {
        const cycles = {
            a: { tasks: [{ completed: true }, { completed: true }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } }
        };
        // Frozen at midday so 00:00 has unambiguously passed — at exactly
        // midnight the trigger time is EQUAL to now, not past.
        await withFrozenClock(12, 0, async () => {
            const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
            await manager.checkAllRoutines();
            const cycle = getState().data.cycles.a;
            if (cycle.tasks.some(t => t.completed)) throw new Error('All tasks should be unchecked');
            if (cycle.autoUncheckDaily.lastResetDate !== todayLocal()) throw new Error('lastResetDate not set');
        });
    });

    await test('Active cycle fire clears pendingNotification immediately', async () => {
        const cycles = { a: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } } };
        const { manager, getState, notifications } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        await manager.checkAllRoutines();
        if (getState().data.cycles.a.autoUncheckDaily.pendingNotification !== false) {
            throw new Error('pendingNotification should be false for active cycle');
        }
        if (notifications.length !== 1) throw new Error('Should have shown one notification');
    });

    await test('Inactive cycle fire defers pendingNotification', async () => {
        const cycles = {
            a: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } },
            b: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } }
        };
        const { manager, getState, notifications } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'b' }) });
        await manager.checkAllRoutines();
        // a is inactive — pending should be true; b is active — pending should be false
        if (getState().data.cycles.a.autoUncheckDaily.pendingNotification !== true) {
            throw new Error('Inactive cycle pendingNotification should be true');
        }
        if (getState().data.cycles.b.autoUncheckDaily.pendingNotification !== false) {
            throw new Error('Active cycle pendingNotification should be false');
        }
        // Only one notification (for active cycle b)
        if (notifications.length !== 1) throw new Error(`Expected 1 notification, got ${notifications.length}`);
    });

    await test('Same-day re-check does not fire again (idempotent)', async () => {
        const cycles = {
            a: { tasks: [{ completed: false }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0, lastResetDate: todayLocal() } }
        };
        const { manager, updates } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        await manager.checkAllRoutines();
        if (updates.length !== 0) throw new Error('Should not fire if already fired today');
    });

    await test('Multi-routine: only due routines fire', async () => {
        const today = todayLocal();
        const cycles = {
            a: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } },
            b: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: true, hour: 0, minute: 0, lastResetDate: today } },
            c: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: false, hour: 0, minute: 0 } }
        };
        const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        await manager.checkAllRoutines();
        if (getState().data.cycles.a.tasks[0].completed) throw new Error('a should fire');
        if (!getState().data.cycles.b.tasks[0].completed) throw new Error('b already fired today, should be unchanged');
        if (!getState().data.cycles.c.tasks[0].completed) throw new Error('c is disabled, should be unchanged');
    });

    // =========================================================
    // 👀 VIEW-TIME NOTIFICATION
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">👀 showPendingNotificationIfAny</h4>';

    await test('Shows toast and clears flag when pending', () => {
        const cycles = {
            a: { tasks: [], autoUncheckDaily: { enabled: true, hour: 6, minute: 0, pendingNotification: true } }
        };
        const { manager, getState, notifications } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.showPendingNotificationIfAny('a');
        if (notifications.length !== 1) throw new Error('Expected one notification');
        if (getState().data.cycles.a.autoUncheckDaily.pendingNotification !== false) throw new Error('Flag not cleared');
    });

    await test('Silent when no pending notification', () => {
        const cycles = {
            a: { tasks: [], autoUncheckDaily: { enabled: true, hour: 6, minute: 0, pendingNotification: false } }
        };
        const { manager, notifications } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.showPendingNotificationIfAny('a');
        if (notifications.length !== 0) throw new Error('Should not notify');
    });

    // =========================================================
    // 🎛️ USER ACTIONS
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ setEnabled / setTime</h4>';

    await test('setEnabled(true) sets state and shows enabled notification', () => {
        const cycles = { a: { tasks: [], autoUncheckDaily: undefined } };
        const { manager, getState, notifications } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.setEnabled('a', true);
        if (!getState().data.cycles.a.autoUncheckDaily.enabled) throw new Error('enabled should be true');
        if (notifications.length !== 1) throw new Error(`Expected exactly one (enabled) notification, got ${notifications.length}`);
    });

    await test('setEnabled(true) with already-passed trigger does NOT uncheck tasks (first fire waits for next occurrence)', async () => {
        // Fresh list, default 12:00 AM trigger — always in the past at enable time.
        const cycles = { a: { tasks: [{ completed: true }, { completed: false }], autoUncheckDaily: undefined } };
        const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.setEnabled('a', true);
        const s = getState().data.cycles.a;
        if (!s.tasks[0].completed) throw new Error('Completed task was unchecked immediately on enable');
        if (s.autoUncheckDaily.lastResetDate !== todayLocal()) {
            throw new Error('lastResetDate should be stamped today so the first fire is tomorrow');
        }
        // And a follow-up check must not fire either (idempotency guard holds)
        await manager.checkAllRoutines();
        if (!getState().data.cycles.a.tasks[0].completed) throw new Error('Follow-up check unchecked tasks same-day');
    });

    await test('setEnabled(true) with still-upcoming trigger leaves lastResetDate null (fires later today)', () => {
        // Skip in the last minute of the day where 23:59 is no longer "upcoming"
        const now = new Date();
        if (now.getHours() === 23 && now.getMinutes() >= 59) return;
        const cycles = { a: { tasks: [{ completed: true }], autoUncheckDaily: { enabled: false, hour: 23, minute: 59, lastResetDate: null, pendingNotification: false } } };
        const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.setEnabled('a', true);
        const s = getState().data.cycles.a.autoUncheckDaily;
        if (s.lastResetDate !== null) throw new Error('lastResetDate should stay null so today\'s upcoming trigger still fires');
        if (!getState().data.cycles.a.tasks[0].completed) throw new Error('Tasks should not be unchecked before the trigger time');
    });

    await test('setEnabled(false) shows disabled notification and stops firing', () => {
        const cycles = { a: { tasks: [], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } } };
        const { manager, getState, notifications } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.setEnabled('a', false);
        if (getState().data.cycles.a.autoUncheckDaily.enabled !== false) throw new Error('enabled should be false');
        if (notifications.length !== 1) throw new Error('Expected one notification');
    });

    await test('setTime clamps invalid input', () => {
        const cycles = { a: { tasks: [], autoUncheckDaily: { enabled: true, hour: 0, minute: 0 } } };
        const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.setTime('a', 99, -5);
        const s = getState().data.cycles.a.autoUncheckDaily;
        if (s.hour !== 23 || s.minute !== 0) throw new Error(`Got hour=${s.hour}, min=${s.minute}`);
    });

    await test('setTime to future time clears lastResetDate', () => {
        // Set lastResetDate to today, then change time to 23:59 (future)
        const cycles = {
            a: {
                tasks: [],
                autoUncheckDaily: { enabled: true, hour: 0, minute: 0, lastResetDate: todayLocal() }
            }
        };
        const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        manager.setTime('a', 23, 59);
        // Skip if it's already past 23:59
        const now = new Date();
        if (now.getHours() === 23 && now.getMinutes() >= 59) return;
        if (getState().data.cycles.a.autoUncheckDaily.lastResetDate !== null) {
            throw new Error('lastResetDate should be cleared when new time is in the future');
        }
    });

    // =========================================================
    // 🛡️ DEFENSIVE
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Defensive</h4>';

    await test('checkAllRoutines tolerates empty state', async () => {
        const { manager } = makeManager({ state: { data: null, appState: {}, settings: {}, metadata: {} } });
        // Should not throw
        await manager.checkAllRoutines();
    });

    await test('Routine without autoUncheckDaily field is ignored', async () => {
        const cycles = { a: { tasks: [{ completed: true }] } };
        const { manager, getState } = makeManager({ state: makeMockState({ cycles, activeCycleId: 'a' }) });
        await manager.checkAllRoutines();
        if (!getState().data.cycles.a.tasks[0].completed) throw new Error('Should not have unchecked');
    });

    // =========================================================
    // ♿ DOM FALLBACK — accessible name must track the checkbox
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">♿ DOM Fallback</h4>';

    /**
     * Build a task list holding one completed, overdue row and return the pieces.
     * The row carries a deliberately STALE aria-label saying "Completed" so a
     * fallback that only flips `checked` leaves an announcement contradicting
     * the control it describes.
     */
    function makeStaleTaskList({ recurring = false } = {}) {
        const list = document.createElement('ul');
        list.id = 'taskList-a11y-probe';
        const row = document.createElement('li');
        row.className = recurring ? 'task overdue-task recurring' : 'task overdue-task';
        row.setAttribute('aria-label', 'Water the plants, Completed');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        const text = document.createElement('span');
        text.className = 'task-text';
        text.textContent = 'Water the plants';
        row.append(checkbox, text);
        list.appendChild(row);
        return { list, row, checkbox };
    }

    await test('DOM fallback rewrites aria-label, not just the checkbox', async () => {
        const { list, row, checkbox } = makeStaleTaskList();
        // No loadMiniCycle dep -> the fallback branch is the one under test.
        const { manager } = makeManager({
            state: makeMockState(),
            onGetById: (id) => (id === 'taskList' ? list : null)
        });

        manager._refreshActiveCycleUI();

        if (checkbox.checked) throw new Error('Checkbox should have been unchecked');
        if (row.classList.contains('overdue-task')) throw new Error('Overdue class should have been cleared');

        const label = row.getAttribute('aria-label');
        if (label === 'Water the plants, Completed') {
            throw new Error('aria-label still announces "Completed" on an unchecked row');
        }
        const expected = getLabel('action.taskItemLabel', {
            vars: { name: 'Water the plants', status: getLabel('nav.notCompleted') }
        });
        if (label !== expected) throw new Error(`Got "${label}", expected "${expected}"`);
    });

    await test('DOM fallback keeps the recurring variant of the label', async () => {
        const { list, row } = makeStaleTaskList({ recurring: true });
        const { manager } = makeManager({
            state: makeMockState(),
            onGetById: (id) => (id === 'taskList' ? list : null)
        });

        manager._refreshActiveCycleUI();

        const expected = getLabel('action.taskItemRecurring', {
            vars: { name: 'Water the plants', status: getLabel('nav.notCompleted') }
        });
        const label = row.getAttribute('aria-label');
        if (label !== expected) throw new Error(`Got "${label}", expected "${expected}"`);
    });

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
