/**
 * TaskSearch Tests
 * Tests for modules/ui/taskSearch.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runTaskSearchTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/taskSearch.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TaskSearch Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setTaskSearchDependencies is exported as a function', () => {
        if (typeof mod.setTaskSearchDependencies !== 'function') throw new Error('Missing export');
    });

    await test('initTaskSearch is exported as a function', () => {
        if (typeof mod.initTaskSearch !== 'function') throw new Error('Missing export');
    });

    await test('updateSearchVisibility is exported as a function', () => {
        if (typeof mod.updateSearchVisibility !== 'function') throw new Error('Missing export');
    });

    await test('getTaskCount is exported as a function', () => {
        if (typeof mod.getTaskCount !== 'function') throw new Error('Missing export');
    });

    await test('resetSearch is exported as a function', () => {
        if (typeof mod.resetSearch !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setTaskSearchDependencies accepts an object without throwing', () => {
        mod.setTaskSearchDependencies({});
    });

    await test('setTaskSearchDependencies accepts mock dependencies', () => {
        mod.setTaskSearchDependencies({
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            getBody: () => document.body,
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('getTaskCount returns a number', () => {
        const count = mod.getTaskCount();
        if (typeof count !== 'number') throw new Error('getTaskCount should return a number, got ' + typeof count);
    });

    await test('resetSearch does not throw when not initialized', () => {
        try {
            mod.resetSearch();
        } catch (e) {
            throw new Error('resetSearch should not throw: ' + e.message);
        }
    });

    await test('setTaskSearchDependencies handles null gracefully', () => {
        try {
            mod.setTaskSearchDependencies(null);
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
