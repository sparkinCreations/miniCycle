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
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 activateTaskRecurringState</h4>';

    await test('activateTaskRecurringState flips a matching task recurring and creates its template', () => {
        const cycle = {
            tasks: [{ id: 'task-1', text: 'Water plants', highPriority: true, priorityColor: '#f00' }],
            recurringTemplates: {}
        };
        const settings = { frequency: 'daily', indefinitely: true, time: null };
        // Sentinel calcFn so we can prove the template's nextScheduledOccurrence came from it.
        activateTaskRecurringState(cycle, 'task-1', settings, () => 424242);

        const task = cycle.tasks[0];
        if (task.recurring !== true) throw new Error('task.recurring should be set true');
        if (task.recurringSettings.frequency !== 'daily') throw new Error('settings should be cloned onto task');
        if (task.recurringSettings === settings) throw new Error('settings should be a clone, not the same ref');
        if (task.deleteWhenComplete !== true) throw new Error('recurring tasks should get deleteWhenComplete=true');

        const tmpl = cycle.recurringTemplates['task-1'];
        if (!tmpl) throw new Error('template should be created keyed by taskId');
        if (tmpl.recurring !== true) throw new Error('template.recurring should be true');
        if (tmpl.text !== 'Water plants') throw new Error('template should carry the task text');
        if (tmpl.highPriority !== true || tmpl.priorityColor !== '#f00') throw new Error('template should copy priority fields');
        if (tmpl.occurrenceCount !== 0) throw new Error('new template should start at occurrenceCount 0');
        if (tmpl.nextScheduledOccurrence !== 424242) throw new Error('template should use calcFn output for nextScheduledOccurrence');
    });

    await test('activateTaskRecurringState creates a template even when the task is absent', () => {
        // Source: the template is written unconditionally (falls back to untitled text),
        // so the "no matching task" path is not a no-op — it still registers a template.
        const cycle = { tasks: [], recurringTemplates: {} };
        activateTaskRecurringState(cycle, 'ghost', { frequency: 'weekly' }, () => 5);
        const tmpl = cycle.recurringTemplates['ghost'];
        if (!tmpl) throw new Error('template should be created for absent task');
        if (tmpl.recurring !== true) throw new Error('template.recurring should be true');
        if (tmpl.highPriority !== false) throw new Error('absent-task template should default highPriority=false');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">↩️ deactivateTaskRecurringState</h4>';

    await test('deactivateTaskRecurringState clears recurring and deletes the template', () => {
        const cycle = {
            tasks: [{ id: 'task-1', text: 'X', recurring: true, recurringSettings: { frequency: 'daily' } }],
            recurringTemplates: { 'task-1': { id: 'task-1', recurring: true } }
        };
        deactivateTaskRecurringState(cycle, 'task-1', 'cycle');

        const task = cycle.tasks[0];
        if (task.recurring !== false) throw new Error('task.recurring should be false after deactivate');
        // Settings are preserved so re-activation remembers config.
        if (!task.recurringSettings) throw new Error('recurringSettings should be preserved for re-activation');
        if (cycle.recurringTemplates['task-1']) throw new Error('template should be removed');
    });

    await test('deactivateTaskRecurringState is a safe no-op when task/template absent', () => {
        const cycle = { tasks: [], recurringTemplates: {} };
        deactivateTaskRecurringState(cycle, 'task-1', 'cycle');
        if (Object.keys(cycle.recurringTemplates).length !== 0) throw new Error('nothing should be added');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 removeRecurringTasksFromCycle</h4>';

    await test('removeRecurringTasksFromCycle removes a completed recurring task from the array + DOM', () => {
        const el = document.createElement('div');
        el.className = 'recurring';           // DOM_CLASSES.RECURRING
        el.dataset.taskId = 'task-1';
        el.innerHTML = '<input type="checkbox" checked>';
        document.body.appendChild(el);

        // deleteWhenComplete !== false → the task should be removed. No template present,
        // so calculateNextOccurrence is never called (kept out of deps intentionally).
        const cycle = {
            tasks: [{ id: 'task-1', deleteWhenComplete: true }, { id: 'task-2' }],
            recurringTemplates: {}
        };
        removeRecurringTasksFromCycle([el], cycle);

        if (cycle.tasks.find(t => t.id === 'task-1')) throw new Error('recurring task should be spliced from array');
        if (!cycle.tasks.find(t => t.id === 'task-2')) throw new Error('non-recurring task should remain');
        if (document.body.contains(el)) throw new Error('recurring task element should be removed from DOM');
    });

    await test('removeRecurringTasksFromCycle keeps a recurring task flagged deleteWhenComplete=false', () => {
        const el = document.createElement('div');
        el.className = 'recurring';
        el.dataset.taskId = 'task-1';
        el.innerHTML = '<input type="checkbox" checked>';
        document.body.appendChild(el);

        const cycle = {
            tasks: [{ id: 'task-1', deleteWhenComplete: false, completed: true }],
            recurringTemplates: {}
        };
        removeRecurringTasksFromCycle([el], cycle);

        const task = cycle.tasks.find(t => t.id === 'task-1');
        if (!task) throw new Error('kept task should remain in the array');
        if (task.completed !== false) throw new Error('kept task should be un-completed for the next cycle');
        const cb = el.querySelector('input[type="checkbox"]');
        if (cb.checked !== false) throw new Error('kept task checkbox should be unchecked');
        el.remove();
    });

    await test('removeRecurringTasksFromCycle ignores non-recurring elements', () => {
        const el = document.createElement('div');
        el.dataset.taskId = 'task-1';    // no 'recurring' class
        const cycle = { tasks: [{ id: 'task-1' }], recurringTemplates: {} };
        removeRecurringTasksFromCycle([el], cycle);
        if (cycle.tasks.length !== 1) throw new Error('non-recurring task should be untouched');
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
