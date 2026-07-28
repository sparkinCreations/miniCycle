/**
 * BackupReminder Tests
 * Tests for modules/features/backupReminder.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runBackupReminderTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/backupReminder.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>BackupReminder Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setBackupReminderDependencies is exported as a function', () => {
        if (typeof mod.setBackupReminderDependencies !== 'function') throw new Error('Missing export');
    });

    await test('checkBackupReminderOnBoot is exported as a function', () => {
        if (typeof mod.checkBackupReminderOnBoot !== 'function') throw new Error('Missing export');
    });

    await test('checkBackupReminderOnCycleComplete is exported as a function', () => {
        if (typeof mod.checkBackupReminderOnCycleComplete !== 'function') throw new Error('Missing export');
    });

    await test('checkBackupReminderOnTaskClear is exported as a function', () => {
        if (typeof mod.checkBackupReminderOnTaskClear !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setBackupReminderDependencies accepts an object without throwing', () => {
        mod.setBackupReminderDependencies({});
    });

    await test('setBackupReminderDependencies accepts mock dependencies', () => {
        mod.setBackupReminderDependencies({
            AppState: { get: () => ({ settings: {}, userProgress: {} }), update: () => {} },
            showConfirmationModal: () => {},
            showNotification: () => {},
            downloadBackupFile: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setBackupReminderDependencies handles null gracefully', () => {
        try {
            mod.setBackupReminderDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    await test('checkBackupReminderOnCycleComplete does not throw without full deps', () => {
        mod.setBackupReminderDependencies({
            AppState: {
                get: () => ({
                    settings: { backupReminder: {} },
                    userProgress: { cycles: 0, tasks: 0 }
                }),
                update: () => {}
            },
            showConfirmationModal: () => {}
        });
        try {
            mod.checkBackupReminderOnCycleComplete();
        } catch (e) {
            throw new Error('Should handle missing optional deps: ' + e.message);
        }
    });

    await test('checkBackupReminderOnTaskClear does not throw without full deps', () => {
        mod.setBackupReminderDependencies({
            AppState: {
                get: () => ({
                    settings: { backupReminder: {} },
                    userProgress: { cycles: 0, tasks: 0 }
                }),
                update: () => {}
            },
            showConfirmationModal: () => {}
        });
        try {
            mod.checkBackupReminderOnTaskClear();
        } catch (e) {
            throw new Error('Should handle missing optional deps: ' + e.message);
        }
    });

    // ============================================
    // 🧠 Cadence / cooldown decision logic
    // The module reads Date.now() directly (no injectable clock), so timestamps are set
    // RELATIVE to Date.now(). The boot path calls _showReminder() synchronously; the
    // cycle/task paths defer via setTimeout(fn, 2000), so those are checked by spying
    // setTimeout to observe whether a show was scheduled.
    // The module reads progress from userProgress.cyclesCompleted / totalTasksCompleted
    // (NOT cycles/tasks), and cadence snapshots from settings.*.
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧠 Cadence / Cooldown</h4>';

    const DAY = 24 * 60 * 60 * 1000;

    function wire({ settings = {}, cyclesCompleted = 0, totalTasksCompleted = 0, downloadBackupFile } = {}) {
        const state = { settings: { ...settings }, userProgress: { cyclesCompleted, totalTasksCompleted } };
        const modalCalls = [];
        const deps = {
            AppState: { get: () => state, update: (fn) => fn(state) },
            showConfirmationModal: (opts) => { modalCalls.push(opts); },
            showNotification: () => {},
        };
        if (downloadBackupFile) deps.downloadBackupFile = downloadBackupFile;
        mod.setBackupReminderDependencies(deps);
        return { state, modalCalls };
    }

    await test('boot reminder is suppressed while on any cooldown', () => {
        const now = Date.now();
        // Anti-stacking: shown 2 days ago (< 3-day window).
        let w = wire({ settings: { lastBackupReminderShown: now - 2 * DAY }, cyclesCompleted: 5 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 0) throw new Error('anti-stacking cooldown should suppress the reminder');

        // Dismiss cooldown: dismissedUntil in the future.
        w = wire({ settings: { backupReminderDismissedUntil: now + 5 * DAY }, cyclesCompleted: 5 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 0) throw new Error('dismiss cooldown should suppress the reminder');

        // Recent backup: backed up 1 day ago (< 3 days).
        w = wire({ settings: { lastFileBackupTimestamp: now - 1 * DAY }, cyclesCompleted: 5 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 0) throw new Error('a recent file backup should suppress the reminder');
    });

    await test('boot reminder shows first-ever and after the 14-day cadence, not before', () => {
        const now = Date.now();
        // First-ever (never shown) with at least 1 completed cycle.
        let w = wire({ settings: { lastBackupReminderShown: 0 }, cyclesCompleted: 3 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 1) throw new Error('first-ever reminder should show');

        // 15 days since last → past the 14-day cadence.
        w = wire({ settings: { lastBackupReminderShown: now - 15 * DAY }, cyclesCompleted: 3 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 1) throw new Error('reminder should show once 14 days have elapsed');

        // 10 days since last: past 3-day anti-stacking but before the 14-day cadence → NOT shown.
        w = wire({ settings: { lastBackupReminderShown: now - 10 * DAY }, cyclesCompleted: 3 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 0) throw new Error('reminder must not show before the 14-day cadence');
    });

    await test('boot reminder respects the new-user guard (0 completed cycles)', () => {
        // 0 cycles + never shown: the new-user guard blocks even the first-ever rule.
        const w = wire({ settings: { lastBackupReminderShown: 0 }, cyclesCompleted: 0 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 0) throw new Error('brand-new users (0 cycles) should not get a backup reminder');
    });

    await test('showing the reminder records the cadence snapshot', () => {
        const before = Date.now();
        const w = wire({ settings: { lastBackupReminderShown: 0 }, cyclesCompleted: 7, totalTasksCompleted: 42 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 1) throw new Error('precondition: reminder should show');
        // _recordReminderShown stamps now + snapshots progress so the next cadence measures from here.
        if (w.state.settings.lastBackupReminderShown < before) throw new Error('lastBackupReminderShown should be stamped to ~now');
        if (w.state.settings.cyclesAtLastBackupReminder !== 7) throw new Error('should snapshot cyclesCompleted');
        if (w.state.settings.clearedTasksAtLastBackupReminder !== 42) throw new Error('should snapshot totalTasksCompleted');
    });

    await test('confirming the reminder triggers a backup download', () => {
        let dlArgs = null;
        const w = wire({ settings: { lastBackupReminderShown: 0 }, cyclesCompleted: 3, downloadBackupFile: (opts) => { dlArgs = opts; } });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 1) throw new Error('precondition: reminder should show');
        w.modalCalls[0].callback(true); // user confirms
        if (!dlArgs || dlArgs.skipNamePrompt !== true) throw new Error('confirm should call downloadBackupFile({ skipNamePrompt: true })');
    });

    await test('dismissing the reminder arms the 7-day dismiss cooldown', () => {
        const before = Date.now();
        const w = wire({ settings: { lastBackupReminderShown: 0 }, cyclesCompleted: 3 });
        mod.checkBackupReminderOnBoot();
        if (w.modalCalls.length !== 1) throw new Error('precondition: reminder should show');
        w.modalCalls[0].callback(false); // user dismisses
        const until = w.state.settings.backupReminderDismissedUntil;
        if (!until || until < before + 6 * DAY) throw new Error('dismiss should set dismissedUntil ~7 days out');
    });

    await test('cycle-complete reminder schedules only past the 25-cycle cadence', () => {
        const origSetTimeout = window.setTimeout;
        let scheduled = 0;
        window.setTimeout = () => { scheduled++; return 0; };
        try {
            // delta 25 (>= 25) → scheduled
            wire({ settings: { cyclesAtLastBackupReminder: 0 }, cyclesCompleted: 25 });
            scheduled = 0; mod.checkBackupReminderOnCycleComplete();
            if (scheduled !== 1) throw new Error('a 25-cycle delta should schedule the reminder');

            // delta 24 (< 25) → not scheduled
            wire({ settings: { cyclesAtLastBackupReminder: 0 }, cyclesCompleted: 24 });
            scheduled = 0; mod.checkBackupReminderOnCycleComplete();
            if (scheduled !== 0) throw new Error('a 24-cycle delta should not schedule');

            // delta measured SINCE last reminder, not absolute: 50 - 30 = 20 → not scheduled
            wire({ settings: { cyclesAtLastBackupReminder: 30 }, cyclesCompleted: 50 });
            scheduled = 0; mod.checkBackupReminderOnCycleComplete();
            if (scheduled !== 0) throw new Error('cadence should measure the delta since the last reminder');
        } finally {
            window.setTimeout = origSetTimeout;
        }
    });

    await test('task-clear reminder schedules only past the 100-task cadence', () => {
        const origSetTimeout = window.setTimeout;
        let scheduled = 0;
        window.setTimeout = () => { scheduled++; return 0; };
        try {
            wire({ settings: { clearedTasksAtLastBackupReminder: 0 }, totalTasksCompleted: 100 });
            scheduled = 0; mod.checkBackupReminderOnTaskClear();
            if (scheduled !== 1) throw new Error('a 100-task delta should schedule the reminder');

            wire({ settings: { clearedTasksAtLastBackupReminder: 0 }, totalTasksCompleted: 99 });
            scheduled = 0; mod.checkBackupReminderOnTaskClear();
            if (scheduled !== 0) throw new Error('a 99-task delta should not schedule');
        } finally {
            window.setTimeout = origSetTimeout;
        }
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
