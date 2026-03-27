/**
 * AppContext Tests
 * Tests for modules/core/appContext.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runAppContextTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/core/appContext.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>AppContext Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('state is an exported function', () => {
        if (typeof mod.state !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.state}`);
        }
    });

    await test('task is an exported function', () => {
        if (typeof mod.task !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.task}`);
        }
    });

    await test('cycle is an exported function', () => {
        if (typeof mod.cycle !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.cycle}`);
        }
    });

    await test('ui is an exported function', () => {
        if (typeof mod.ui !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.ui}`);
        }
    });

    await test('registerApi and getApi are exported functions', () => {
        if (typeof mod.registerApi !== 'function') {
            throw new Error(`registerApi: expected function, got ${typeof mod.registerApi}`);
        }
        if (typeof mod.getApi !== 'function') {
            throw new Error(`getApi: expected function, got ${typeof mod.getApi}`);
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
