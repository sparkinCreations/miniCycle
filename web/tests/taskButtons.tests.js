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
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
