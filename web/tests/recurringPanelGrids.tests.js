/**
 * RecurringPanelGrids Tests
 * Tests for modules/recurring/recurringPanelGrids.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelGridsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelGrids.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringPanelGrids Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('generateMonthlyDayGrid is an exported function', () => {
        if (typeof mod.generateMonthlyDayGrid !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.generateMonthlyDayGrid}`);
        }
    });

    await test('generateYearlyMonthGrid is an exported function', () => {
        if (typeof mod.generateYearlyMonthGrid !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.generateYearlyMonthGrid}`);
        }
    });

    await test('generateYearlyDayGrid is an exported function', () => {
        if (typeof mod.generateYearlyDayGrid !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.generateYearlyDayGrid}`);
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
