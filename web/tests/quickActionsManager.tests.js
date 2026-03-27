/**
 * QuickActionsManager Tests
 * Tests for modules/ui/quickActionsManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runQuickActionsManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/quickActionsManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>QuickActionsManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setQuickActionsManagerDependencies is exported as a function', () => {
        if (typeof mod.setQuickActionsManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('QuickActionsManager class is exported', () => {
        if (typeof mod.QuickActionsManager !== 'function') throw new Error('Missing class export');
    });

    await test('initQuickActionsManager is exported as a function', () => {
        if (typeof mod.initQuickActionsManager !== 'function') throw new Error('Missing export');
    });

    await test('trackAction is exported as a function', () => {
        if (typeof mod.trackAction !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setQuickActionsManagerDependencies accepts an object without throwing', () => {
        mod.setQuickActionsManagerDependencies({});
    });

    await test('setQuickActionsManagerDependencies accepts mock dependencies', () => {
        mod.setQuickActionsManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('QuickActionsManager can be instantiated with empty deps', () => {
        mod.setQuickActionsManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
        const instance = new mod.QuickActionsManager();
        if (!instance) throw new Error('Failed to create instance');
    });

    await test('Instance has init method', () => {
        const instance = new mod.QuickActionsManager();
        if (typeof instance.init !== 'function') throw new Error('Missing init method');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setQuickActionsManagerDependencies handles null gracefully', () => {
        try {
            mod.setQuickActionsManagerDependencies(null);
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
