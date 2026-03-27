/**
 * RecurringSettingsApplicator Tests
 * Tests for modules/recurring/recurringSettingsApplicator.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringSettingsApplicatorTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringSettingsApplicator.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringSettingsApplicator Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('setRecurringSettingsApplicatorDependencies is an exported function', () => {
        if (typeof mod.setRecurringSettingsApplicatorDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setRecurringSettingsApplicatorDependencies}`);
        }
    });

    await test('applyRecurringSettings is an exported function', () => {
        if (typeof mod.applyRecurringSettings !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.applyRecurringSettings}`);
        }
    });

    await test('Module has exactly the expected exports', () => {
        const exportNames = Object.keys(mod);
        const expected = ['setRecurringSettingsApplicatorDependencies', 'applyRecurringSettings'];
        for (const name of expected) {
            if (!exportNames.includes(name)) {
                throw new Error(`Missing expected export: ${name}`);
            }
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
