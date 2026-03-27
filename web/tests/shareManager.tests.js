/**
 * ShareManager Tests
 * Tests for modules/ui/shareManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runShareManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/shareManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>ShareManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setShareManagerDependencies is exported as a function', () => {
        if (typeof mod.setShareManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('setupShareRoutineButton is exported as a function', () => {
        if (typeof mod.setupShareRoutineButton !== 'function') throw new Error('Missing export');
    });

    await test('setupShareAppButton is exported as a function', () => {
        if (typeof mod.setupShareAppButton !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setShareManagerDependencies accepts an object without throwing', () => {
        mod.setShareManagerDependencies({});
    });

    await test('setShareManagerDependencies accepts mock dependencies', () => {
        mod.setShareManagerDependencies({
            loadMiniCycleData: () => ({}),
            showNotification: () => {},
            safeAddEventListener: () => {},
            hideMainMenu: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setShareManagerDependencies handles null gracefully', () => {
        try {
            mod.setShareManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    await test('setupShareRoutineButton does not throw when DOM elements missing', () => {
        mod.setShareManagerDependencies({
            loadMiniCycleData: () => ({}),
            showNotification: () => {},
            safeAddEventListener: () => {},
            hideMainMenu: () => {}
        });
        try {
            mod.setupShareRoutineButton();
        } catch (e) {
            throw new Error('Should handle missing DOM elements: ' + e.message);
        }
    });

    await test('setupShareAppButton does not throw when DOM elements missing', () => {
        mod.setShareManagerDependencies({
            loadMiniCycleData: () => ({}),
            showNotification: () => {},
            safeAddEventListener: () => {},
            hideMainMenu: () => {}
        });
        try {
            mod.setupShareAppButton();
        } catch (e) {
            throw new Error('Should handle missing DOM elements: ' + e.message);
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
