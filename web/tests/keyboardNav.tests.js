/**
 * KeyboardNav Tests
 * Tests for modules/utils/keyboardNav.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runKeyboardNavTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/keyboardNav.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>KeyboardNav Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('handleVerticalArrowNav is an exported function', () => {
        if (typeof mod.handleVerticalArrowNav !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.handleVerticalArrowNav}`);
        }
    });

    await test('handleHorizontalArrowNav is an exported function', () => {
        if (typeof mod.handleHorizontalArrowNav !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.handleHorizontalArrowNav}`);
        }
    });

    await test('handleGridArrowNav is an exported function', () => {
        if (typeof mod.handleGridArrowNav !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.handleGridArrowNav}`);
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
