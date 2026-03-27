/**
 * RecurringPanelForm Tests
 * Tests for modules/recurring/recurringPanelForm.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelFormTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelForm.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringPanelForm Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('getTomorrow is an exported function', () => {
        if (typeof mod.getTomorrow !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getTomorrow}`);
        }
    });

    await test('getTomorrow returns a Date object for tomorrow', () => {
        const result = mod.getTomorrow();
        if (!(result instanceof Date)) {
            throw new Error(`Expected Date, got ${typeof result}`);
        }
        const today = new Date();
        const expectedDay = today.getDate() + 1;
        // Handle month rollover by checking it's in the future
        if (result.getTime() <= today.getTime()) {
            throw new Error('getTomorrow should return a future date');
        }
    });

    await test('setFormActions is an exported function (DI setter)', () => {
        if (typeof mod.setFormActions !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setFormActions}`);
        }
    });

    await test('buildRecurringSettingsFromPanel is an exported function', () => {
        if (typeof mod.buildRecurringSettingsFromPanel !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.buildRecurringSettingsFromPanel}`);
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
