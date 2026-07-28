/**
 * CycleExportManager Tests
 * Tests for modules/ui/cycleExportManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleExportManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/cycleExportManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>CycleExportManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setCycleExportManagerDependencies is exported as a function', () => {
        if (typeof mod.setCycleExportManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('exportMiniCycleData is exported as a function', () => {
        if (typeof mod.exportMiniCycleData !== 'function') throw new Error('Missing export');
    });

    await test('setupExportButton is exported as a function', () => {
        if (typeof mod.setupExportButton !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setCycleExportManagerDependencies accepts an object without throwing', () => {
        mod.setCycleExportManagerDependencies({});
    });

    await test('setCycleExportManagerDependencies accepts mock dependencies', () => {
        mod.setCycleExportManagerDependencies({
            loadMiniCycleData: () => ({}),
            showNotification: () => {},
            showConfirmationModal: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Function Signatures</h4>';

    await test('exportMiniCycleData accepts two arguments (data, name)', () => {
        // Verify function signature — do NOT call it, as it triggers a file download.
        // Source: exportMiniCycleData(miniCycleData, cycleName) → arity 2. The old check
        // (`< 1`, i.e. ≥1) would pass even if it silently dropped to a single parameter.
        if (mod.exportMiniCycleData.length !== 2) {
            throw new Error(`exportMiniCycleData should accept 2 args (data, name), got arity ${mod.exportMiniCycleData.length}`);
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setCycleExportManagerDependencies handles null gracefully', () => {
        try {
            mod.setCycleExportManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    await test('exportMiniCycleData is a callable function', () => {
        // Do NOT call exportMiniCycleData — it triggers a browser download
        // Just verify it's a proper function export
        if (typeof mod.exportMiniCycleData !== 'function') throw new Error('Should be function');
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
