/**
 * UIOrchestrator Tests
 * Tests for modules/ui/uiOrchestrator.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runUIOrchestratorTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/uiOrchestrator.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>UIOrchestrator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('setUIOrchestratorDependencies is an exported function', () => {
        if (typeof mod.setUIOrchestratorDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setUIOrchestratorDependencies}`);
        }
    });

    await test('requestUIUpdate is an exported function', () => {
        if (typeof mod.requestUIUpdate !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.requestUIUpdate}`);
        }
    });

    await test('UIOrchestrator class is exported', () => {
        if (typeof mod.UIOrchestrator !== 'function') {
            throw new Error(`Expected function (class), got ${typeof mod.UIOrchestrator}`);
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
