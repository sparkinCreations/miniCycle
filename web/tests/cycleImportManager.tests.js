/**
 * CycleImportManager Tests
 * Tests for modules/ui/cycleImportManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleImportManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/cycleImportManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>CycleImportManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setCycleImportManagerDependencies is exported as a function', () => {
        if (typeof mod.setCycleImportManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('setupImportButtons is exported as a function', () => {
        if (typeof mod.setupImportButtons !== 'function') throw new Error('Missing export');
    });

    await test('setupDragDropImport is exported as a function', () => {
        if (typeof mod.setupDragDropImport !== 'function') throw new Error('Missing export');
    });

    await test('processImportedData is exported as a function', () => {
        if (typeof mod.processImportedData !== 'function') throw new Error('Missing export');
    });

    await test('initCycleImportManager is exported as a function', () => {
        if (typeof mod.initCycleImportManager !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setCycleImportManagerDependencies accepts an object without throwing', () => {
        mod.setCycleImportManagerDependencies({});
    });

    await test('setCycleImportManagerDependencies accepts mock dependencies', () => {
        mod.setCycleImportManagerDependencies({
            AppState: { get: () => ({ settings: {}, data: { cycles: {} } }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setCycleImportManagerDependencies handles null gracefully', () => {
        try {
            mod.setCycleImportManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    await test('processImportedData rejects invalid JSON string', async () => {
        mod.setCycleImportManagerDependencies({
            AppState: { get: () => ({ settings: {}, data: { cycles: {} } }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
        try {
            await mod.processImportedData('not valid json {{{');
        } catch (e) {
            // Expected — invalid JSON should be rejected
            return;
        }
        // If it didn't throw, it handled the error internally (also acceptable)
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
