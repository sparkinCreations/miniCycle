/**
 * RecurringPanelSummary Tests
 * Tests for modules/recurring/recurringPanelSummary.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelSummaryTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelSummary.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringPanelSummary Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('buildRecurringSummaryFromSettings is an exported function', () => {
        if (typeof mod.buildRecurringSummaryFromSettings !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.buildRecurringSummaryFromSettings}`);
        }
    });

    await test('buildRecurringSummaryFromSettings returns a string', () => {
        const result = mod.buildRecurringSummaryFromSettings({});
        if (typeof result !== 'string') {
            throw new Error(`Expected string, got ${typeof result}`);
        }
    });

    await test('buildRecurringSummaryFromSettings handles empty input', () => {
        // Should not throw when given empty settings
        let threw = false;
        try {
            mod.buildRecurringSummaryFromSettings();
        } catch (e) {
            threw = true;
        }
        if (threw) {
            throw new Error('Function threw on empty input');
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
