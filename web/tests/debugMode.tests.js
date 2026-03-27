/**
 * DebugMode Tests
 * Tests for modules/utils/debugMode.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runDebugModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/debugMode.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>DebugMode Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('setDebugModeDependencies is an exported function', () => {
        if (typeof mod.setDebugModeDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setDebugModeDependencies}`);
        }
    });

    await test('enableDebug is an exported function', () => {
        if (typeof mod.enableDebug !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.enableDebug}`);
        }
    });

    await test('disableDebug is an exported function', () => {
        if (typeof mod.disableDebug !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.disableDebug}`);
        }
    });

    await test('isDebug is an exported function', () => {
        if (typeof mod.isDebug !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.isDebug}`);
        }
    });

    await test('isDebug returns a boolean', () => {
        const result = mod.isDebug();
        if (typeof result !== 'boolean') {
            throw new Error(`Expected boolean, got ${typeof result}`);
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
