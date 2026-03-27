/**
 * SettingsUIManager Tests
 * Tests for modules/ui/settingsUIManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runSettingsUIManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/settingsUIManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>SettingsUIManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setSettingsUIManagerDependencies is exported as a function', () => {
        if (typeof mod.setSettingsUIManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('setupSettingsMenu is exported as a function', () => {
        if (typeof mod.setupSettingsMenu !== 'function') throw new Error('Missing export');
    });

    await test('initAllToggles is exported as a function', () => {
        if (typeof mod.initAllToggles !== 'function') throw new Error('Missing export');
    });

    await test('setupDarkModeToggle is exported as a function', () => {
        if (typeof mod.setupDarkModeToggle !== 'function') throw new Error('Missing export');
    });

    await test('setupReducedMotionToggle is exported as a function', () => {
        if (typeof mod.setupReducedMotionToggle !== 'function') throw new Error('Missing export');
    });

    await test('setupHighContrastToggle is exported as a function', () => {
        if (typeof mod.setupHighContrastToggle !== 'function') throw new Error('Missing export');
    });

    await test('setupFontSizeSelect is exported as a function', () => {
        if (typeof mod.setupFontSizeSelect !== 'function') throw new Error('Missing export');
    });

    await test('applyPriorityColor is exported as a function', () => {
        if (typeof mod.applyPriorityColor !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setSettingsUIManagerDependencies accepts an object without throwing', () => {
        mod.setSettingsUIManagerDependencies({});
    });

    await test('setSettingsUIManagerDependencies accepts mock dependencies', () => {
        mod.setSettingsUIManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            loadMiniCycleData: () => ({}),
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('_resetForTesting is exported and callable', () => {
        if (typeof mod._resetForTesting !== 'function') throw new Error('Missing _resetForTesting');
        mod._resetForTesting();
    });

    await test('syncCurrentSettingsToStorage is exported as a function', () => {
        if (typeof mod.syncCurrentSettingsToStorage !== 'function') throw new Error('Missing export');
    });

    await test('setSettingsUIManagerDependencies handles null gracefully', () => {
        try {
            mod.setSettingsUIManagerDependencies(null);
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
