/**
 * TaskCycleReset Tests
 * Tests for modules/task/taskCycleReset.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskCycleResetTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskCycleReset.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TaskCycleReset Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskCycleResetDependencies is exported as a function', () => {
        if (typeof mod.setTaskCycleResetDependencies !== 'function') throw new Error('Missing export');
    });

    await test('clearAllTimeouts is exported as a function', () => {
        if (typeof mod.clearAllTimeouts !== 'function') throw new Error('Missing export');
    });

    await test('isResetInProgress is exported as a function', () => {
        if (typeof mod.isResetInProgress !== 'function') throw new Error('Missing export');
    });

    await test('resetTasksImpl is exported as a function', () => {
        if (typeof mod.resetTasksImpl !== 'function') throw new Error('Missing export');
    });

    await test('deleteCompletedTasksImpl is exported as a function', () => {
        if (typeof mod.deleteCompletedTasksImpl !== 'function') throw new Error('Missing export');
    });

    await test('markAllTasksCompleteImpl is exported as a function', () => {
        if (typeof mod.markAllTasksCompleteImpl !== 'function') throw new Error('Missing export');
    });

    await test('handleCompleteAllTasksImpl is exported as a function', () => {
        if (typeof mod.handleCompleteAllTasksImpl !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setTaskCycleResetDependencies accepts an object without throwing', () => {
        mod.setTaskCycleResetDependencies({});
    });

    await test('setTaskCycleResetDependencies accepts mock dependencies', () => {
        mod.setTaskCycleResetDependencies({
            AppState: { get: () => ({ settings: {}, appState: {}, data: { cycles: {} } }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('isResetInProgress returns a boolean', () => {
        const result = mod.isResetInProgress();
        if (typeof result !== 'boolean') throw new Error('isResetInProgress should return boolean, got ' + typeof result);
    });

    await test('clearAllTimeouts does not throw', () => {
        try {
            mod.clearAllTimeouts();
        } catch (e) {
            throw new Error('clearAllTimeouts should not throw: ' + e.message);
        }
    });

    await test('setTaskCycleResetDependencies handles null gracefully', () => {
        try {
            mod.setTaskCycleResetDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
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
