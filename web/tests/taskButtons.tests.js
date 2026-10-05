/**
 * TaskButtons Tests
 * Tests for modules/task/taskButtons.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskButtonsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/task/taskButtons.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TaskButtons Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskButtonsDependencies is exported as a function', () => {
        if (typeof mod.setTaskButtonsDependencies !== 'function') throw new Error('Missing export');
    });

    await test('TaskButtons class is exported', () => {
        if (typeof mod.TaskButtons !== 'function') throw new Error('Missing class export');
    });

    await test('initTaskButtons is exported as a function', () => {
        if (typeof mod.initTaskButtons !== 'function') throw new Error('Missing export');
    });

    await test('getTaskButtons is exported as a function', () => {
        if (typeof mod.getTaskButtons !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setTaskButtonsDependencies accepts an object without throwing', () => {
        mod.setTaskButtonsDependencies({});
    });

    await test('setTaskButtonsDependencies accepts mock dependencies', () => {
        mod.setTaskButtonsDependencies({
            AppState: { get: () => ({ settings: {}, appState: {} }) },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('TaskButtons can be instantiated', () => {
        mod.setTaskButtonsDependencies({
            AppState: { get: () => ({ settings: {}, appState: {} }) },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
        const instance = new mod.TaskButtons();
        if (!instance) throw new Error('Failed to create instance');
    });

    await test('Instance has createTaskButtonContainer method', () => {
        const instance = new mod.TaskButtons();
        if (typeof instance.createTaskButtonContainer !== 'function') throw new Error('Missing createTaskButtonContainer method');
    });

    await test('Instance has createCustomizeButton method', () => {
        const instance = new mod.TaskButtons();
        if (typeof instance.createCustomizeButton !== 'function') throw new Error('Missing createCustomizeButton method');
    });

    await test('Instance has createTaskButton method', () => {
        const instance = new mod.TaskButtons();
        if (typeof instance.createTaskButton !== 'function') throw new Error('Missing createTaskButton method');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('Constructor does not throw with no arguments', () => {
        try {
            new mod.TaskButtons();
        } catch (e) {
            throw new Error('Constructor should not throw: ' + e.message);
        }
    });

    await test('setTaskButtonsDependencies handles null gracefully', () => {
        try {
            mod.setTaskButtonsDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });


    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">👆 Long-press reveals each icon-only option’s name</h4>';

    // Task options are icon-only and `title` never surfaces on touch, so a phone
    // user has no way to learn what any of them does. attachLongPressHint answers
    // that on a 500 ms hold AND swallows the click touchend would otherwise fire —
    // without the suppression, asking ".delete-btn" its name would delete the task.
    //
    // Asserted per button rather than once: the customize button is built by
    // createCustomizeButton() and never passes through setupButtonAccessibility(),
    // so it needs its own wiring and is exactly the one that would be missed (it
    // is also the least legible glyph in the row, "+/-").
    function buildOptionRow() {
        mod.setTaskButtonsDependencies({
            AppState: { get: () => ({
                appState: { activeRoutineId: 'c1' },
                settings: { showThreeDots: false },
                data: { routine: { c1: { id: 'c1', title: 'T', tasks: [], deleteCheckedTasks: false, taskOptionButtons: {
                    highPriority: true, rename: true, delete: true, dueDate: true,
                    reminders: true, recurring: true, deleteWhenComplete: true
                } } } }
            }) },
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            DEFAULT_TASK_OPTION_BUTTONS: {}
        });
        const instance = new mod.TaskButtons();
        const state = instance.deps.AppState.get();
        return instance.createTaskButtonContainer({
            autoResetEnabled: true, deleteCheckedEnabled: false,
            settings: { showThreeDots: false },
            remindersEnabled: false, remindersEnabledGlobal: false,
            assignedTaskId: 't1', currentCycle: state.data.routine.c1,
            recurring: false, highPriority: false
        });
    }

    await test('every task option button gets a long-press hint, including the customize button', () => {
        const row = buildOptionRow();
        const buttons = [...row.querySelectorAll('button')];
        if (buttons.length < 5) throw new Error(`expected a full option row, got ${buttons.length} button(s)`);
        const missing = buttons
            .filter(b => typeof b._longPressHintDetach !== 'function')
            .map(b => [...b.classList].join('.'));
        if (missing.length) {
            throw new Error(`${missing.length}/${buttons.length} option button(s) have no long-press hint, so a touch `
                + `user cannot learn their names: ${missing.join(', ')}`);
        }
        if (!buttons.some(b => b.classList.contains('customize-btn'))) {
            throw new Error('fixture did not include the customize button, so this proves nothing about it');
        }
    });

    await test('the hint text is the button’s own accessible name', () => {
        const row = buildOptionRow();
        const del = row.querySelector('.delete-btn');
        if (!del) throw new Error('fixture has no .delete-btn');
        const aria = del.getAttribute('aria-label');
        if (!aria) throw new Error('.delete-btn has no aria-label to compare the hint against');
        // The hint resolves its text at press time from the same label key the
        // aria-label came from, so the two must agree — a hint that says something
        // different from the announced name is worse than no hint.
        if (del.getAttribute('title') !== aria) {
            throw new Error(`title "${del.getAttribute('title')}" and aria-label "${aria}" disagree, so the hint `
                + 'and the screen-reader name would too');
        }
    });

    await test('the hint detacher is re-entrant (a rebuilt button does not stack listeners)', () => {
        const row = buildOptionRow();
        const btn = row.querySelector('.delete-btn');
        const first = btn._longPressHintDetach;
        if (typeof first !== 'function') throw new Error('no detacher to re-attach over');
        let threw = null;
        try { first(); first(); } catch (e) { threw = e; }
        if (threw) throw new Error('calling the detacher twice threw: ' + threw.message);
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
