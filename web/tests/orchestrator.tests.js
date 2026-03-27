/**
 * Orchestrator Tests
 * Tests for modules/boot/orchestrator.js
 *
 * The orchestrator has no named exports — tests verify the module loads without error.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runOrchestratorTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    let mod, loadError;
    try {
        mod = await import(`../modules/boot/orchestrator.js?v=${cacheBuster}`);
    } catch (e) {
        loadError = e;
    }

    resultsDiv.innerHTML = '<h2>Orchestrator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without throwing', () => {
        if (loadError) throw new Error(`Module failed to load: ${loadError.message}`);
    });

    await test('Module import resolves to an object', () => {
        if (typeof mod !== 'object' || mod === null) {
            throw new Error(`Expected object, got ${typeof mod}`);
        }
    });

    await test('Module has no syntax errors (import succeeded)', () => {
        // If we reach here, the module parsed and executed without syntax errors
        if (loadError) throw loadError;
    });

    await test('Module is a valid ES module namespace', () => {
        // ES module namespaces have a Symbol.toStringTag of 'Module'
        const tag = Object.prototype.toString.call(mod);
        if (tag !== '[object Module]') {
            throw new Error(`Expected [object Module], got ${tag}`);
        }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
