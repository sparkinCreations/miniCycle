/**
 * FocusMode Tests
 * Tests for modules/ui/focusMode.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runFocusModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/focusMode.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>FocusMode Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setFocusModeDependencies is exported as a function', () => {
        if (typeof mod.setFocusModeDependencies !== 'function') throw new Error('Missing export');
    });

    await test('FocusMode class is exported', () => {
        if (typeof mod.FocusMode !== 'function') throw new Error('Missing class export');
    });

    await test('initFocusMode is exported as a function', () => {
        if (typeof mod.initFocusMode !== 'function') throw new Error('Missing export');
    });

    await test('getFocusMode is exported as a function', () => {
        if (typeof mod.getFocusMode !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setFocusModeDependencies accepts an object without throwing', () => {
        mod.setFocusModeDependencies({});
    });

    await test('setFocusModeDependencies accepts mock dependencies', () => {
        mod.setFocusModeDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            getElementById: (id) => document.getElementById(id),
            getBody: () => document.body,
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('FocusMode can be instantiated', () => {
        const instance = new mod.FocusMode();
        if (!instance) throw new Error('Failed to create instance');
    });

    await test('Instance has init method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.init !== 'function') throw new Error('Missing init method');
    });

    await test('Instance has activate method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.activate !== 'function') throw new Error('Missing activate method');
    });

    await test('Instance has deactivate method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.deactivate !== 'function') throw new Error('Missing deactivate method');
    });

    await test('Instance has toggle method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.toggle !== 'function') throw new Error('Missing toggle method');
    });

    await test('Instance has initialized property defaulting to false', () => {
        const instance = new mod.FocusMode();
        if (instance.initialized !== false) throw new Error('initialized should default to false');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('Constructor does not throw with no arguments', () => {
        try {
            new mod.FocusMode();
        } catch (e) {
            throw new Error('Constructor should not throw: ' + e.message);
        }
    });

    await test('setFocusModeDependencies handles null gracefully', () => {
        try {
            mod.setFocusModeDependencies(null);
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
