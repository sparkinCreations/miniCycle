/**
 * RecurringSettings Tests
 * Tests for modules/recurring/recurringSettings.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringSettingsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringSettings.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringSettings Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('normalizeRecurringSettings is an exported function', () => {
        if (typeof mod.normalizeRecurringSettings !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.normalizeRecurringSettings}`);
        }
    });

    await test('normalizeRecurringSettings returns an object', () => {
        const result = mod.normalizeRecurringSettings({});
        if (typeof result !== 'object' || result === null) {
            throw new Error(`Expected object, got ${typeof result}`);
        }
    });

    await test('normalizeRecurringSettings handles empty input', () => {
        let threw = false;
        try {
            mod.normalizeRecurringSettings();
        } catch (e) {
            threw = true;
        }
        if (threw) {
            throw new Error('Function threw on empty input');
        }
    });

    await test('normalizeRecurringSettings result has frequency property', () => {
        const result = mod.normalizeRecurringSettings({});
        if (!('frequency' in result)) {
            throw new Error('Result does not have frequency property');
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
