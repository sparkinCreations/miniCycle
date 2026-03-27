/**
 * AppGlobalState Tests
 * Tests for modules/core/appGlobalState.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runAppGlobalStateTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/appGlobalState.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>AppGlobalState Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('AppGlobalState is an exported object', () => {
        if (typeof mod.AppGlobalState !== 'object' || mod.AppGlobalState === null) {
            throw new Error(`Expected object, got ${typeof mod.AppGlobalState}`);
        }
    });

    await test('FeatureFlags is an exported object', () => {
        if (typeof mod.FeatureFlags !== 'object' || mod.FeatureFlags === null) {
            throw new Error(`Expected object, got ${typeof mod.FeatureFlags}`);
        }
    });

    await test('UNDO_LIMIT is an exported number', () => {
        if (typeof mod.UNDO_LIMIT !== 'number') {
            throw new Error(`Expected number, got ${typeof mod.UNDO_LIMIT}`);
        }
    });

    await test('setDebugAppState is an exported function', () => {
        if (typeof mod.setDebugAppState !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setDebugAppState}`);
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
