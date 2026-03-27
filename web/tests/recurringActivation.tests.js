/**
 * RecurringActivation Tests
 * Tests for activating/deactivating recurring state on tasks and templates
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringActivationTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringActivation.js?v=${cacheBuster}`);
    const {
        setRecurringActivationDependencies, activateTaskRecurringState,
        deactivateTaskRecurringState, removeRecurringTasksFromCycle
    } = mod;

    resultsDiv.innerHTML = '<h2>RecurringActivation Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setRecurringActivationDependencies is exported', () => {
        if (typeof setRecurringActivationDependencies !== 'function') throw new Error('Missing');
    });

    await test('activateTaskRecurringState is exported', () => {
        if (typeof activateTaskRecurringState !== 'function') throw new Error('Missing');
    });

    await test('deactivateTaskRecurringState is exported', () => {
        if (typeof deactivateTaskRecurringState !== 'function') throw new Error('Missing');
    });

    await test('removeRecurringTasksFromCycle is exported', () => {
        if (typeof removeRecurringTasksFromCycle !== 'function') throw new Error('Missing');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Function Signatures</h4>';

    await test('activateTaskRecurringState accepts cycle, taskId, settings, calcFn', () => {
        // Verify the function exists and can be called (may no-op on missing task)
        const cycle = { tasks: [], recurringTemplates: [] };
        activateTaskRecurringState(cycle, 'nonexistent', {}, () => null);
        // Should not throw
    });

    await test('deactivateTaskRecurringState accepts cycle, taskId, mode', () => {
        const cycle = { tasks: [], recurringTemplates: [] };
        deactivateTaskRecurringState(cycle, 'nonexistent', 'auto');
        // Should not throw
    });

    await test('removeRecurringTasksFromCycle accepts taskElements, cycleData', () => {
        const cycle = { tasks: [], recurringTemplates: [] };
        removeRecurringTasksFromCycle([], cycle);
        // Should not throw
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('activateTaskRecurringState handles empty tasks array', () => {
        const cycle = { tasks: [], recurringTemplates: [] };
        activateTaskRecurringState(cycle, 'task-1', { enabled: true }, () => null);
        // Should not throw even with no matching task
    });

    await test('deactivateTaskRecurringState handles empty cycle', () => {
        const cycle = { tasks: [], recurringTemplates: [] };
        deactivateTaskRecurringState(cycle, 'task-1', 'auto');
    });

    await test('removeRecurringTasksFromCycle handles null elements', () => {
        const cycle = { tasks: [{ id: 'task-1' }], recurringTemplates: [] };
        removeRecurringTasksFromCycle([], cycle);
        // Tasks should remain unchanged when no elements passed
        if (cycle.tasks.length !== 1) throw new Error('Tasks should remain');
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
