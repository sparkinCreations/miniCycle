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
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
