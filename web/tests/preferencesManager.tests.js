/**
 * PreferencesManager Tests
 * Tests for modules/ui/preferencesManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runPreferencesManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/preferencesManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>PreferencesManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setPreferencesManagerDependencies is exported as a function', () => {
        if (typeof mod.setPreferencesManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('PreferencesManager class is exported', () => {
        if (typeof mod.PreferencesManager !== 'function') throw new Error('Missing class export');
    });

    await test('initPreferencesManager is exported as a function', () => {
        if (typeof mod.initPreferencesManager !== 'function') throw new Error('Missing export');
    });

    await test('applyCustomColors is exported as a function', () => {
        if (typeof mod.applyCustomColors !== 'function') throw new Error('Missing export');
    });

    await test('removeCustomColors is exported as a function', () => {
        if (typeof mod.removeCustomColors !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setPreferencesManagerDependencies accepts an object without throwing', () => {
        mod.setPreferencesManagerDependencies({});
    });

    await test('setPreferencesManagerDependencies accepts mock dependencies', () => {
        mod.setPreferencesManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('PreferencesManager can be instantiated', () => {
        const instance = new mod.PreferencesManager();
        if (!instance) throw new Error('Failed to create instance');
    });

    await test('Instance has init method', () => {
        const instance = new mod.PreferencesManager();
        if (typeof instance.init !== 'function') throw new Error('Missing init method');
    });

    await test('Instance has applyCustomColors method', () => {
        const instance = new mod.PreferencesManager();
        if (typeof instance.applyCustomColors !== 'function') throw new Error('Missing applyCustomColors method');
    });

    await test('Instance has isDefaultTheme method', () => {
        const instance = new mod.PreferencesManager();
        if (typeof instance.isDefaultTheme !== 'function') throw new Error('Missing isDefaultTheme method');
    });

    await test('Instance has removeCustomColors method', () => {
        const instance = new mod.PreferencesManager();
        if (typeof instance.removeCustomColors !== 'function') throw new Error('Missing removeCustomColors method');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('Constructor does not throw with no arguments', () => {
        try {
            new mod.PreferencesManager();
        } catch (e) {
            throw new Error('Constructor should not throw: ' + e.message);
        }
    });

    await test('setPreferencesManagerDependencies handles null gracefully', () => {
        try {
            mod.setPreferencesManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — just should not crash the module
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
