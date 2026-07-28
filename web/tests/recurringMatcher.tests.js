/**
 * RecurringMatcher Tests
 * Tests for shouldTaskRecurNow() and shouldRecreateRecurringTask() — schedule matching logic
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringMatcherTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringMatcher.js?v=${cacheBuster}`);
    const { shouldTaskRecurNow, shouldRecreateRecurringTask, setDateUtils, setNormalizer } = mod;

    const dateUtilsMod = await import(`../modules/recurring/recurringDateUtils.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringMatcher Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Inject real date utils
    setDateUtils(dateUtilsMod);

    // Normalizer just returns settings as-is for testing
    setNormalizer((s) => ({ ...s, _normalized: true }));

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('shouldTaskRecurNow is exported', () => {
        if (typeof shouldTaskRecurNow !== 'function') throw new Error('Missing export');
    });

    await test('shouldRecreateRecurringTask is exported', () => {
        if (typeof shouldRecreateRecurringTask !== 'function') throw new Error('Missing export');
    });

    await test('setDateUtils is exported', () => {
        if (typeof setDateUtils !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Daily Matching</h4>';

    await test('daily task matches when enabled', () => {
        const now = new Date(2026, 2, 15, 10, 0); // March 15, 10:00 AM
        const settings = {
            enabled: true,
            frequency: 'daily',
            time: { hour: 10, minute: 0, meridiem: 'AM' },
            lastTriggeredTimestamp: 0
        };
        const result = shouldTaskRecurNow(settings, now);
        if (!result) throw new Error('Daily task should match at configured time');
    });

    await test('daily task does not match at wrong time', () => {
        const now = new Date(2026, 2, 15, 8, 0); // 8:00 AM
        const settings = {
            enabled: true,
            frequency: 'daily',
            time: { hour: 10, minute: 0, meridiem: 'AM' },
            lastTriggeredTimestamp: 0
        };
        const result = shouldTaskRecurNow(settings, now);
        if (result) throw new Error('Daily task should not match at wrong time');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔒 Guards</h4>';

    await test('null settings do not match', () => {
        const now = new Date(2026, 2, 15, 10, 0);
        const result = shouldTaskRecurNow(null, now);
        if (result) throw new Error('Null settings should not match');
    });

    await test('expired untilDate does not match', () => {
        const now = new Date(2026, 2, 15, 10, 0);
        const settings = {
            enabled: true,
            frequency: 'daily',
            time: { hour: 10, minute: 0, meridiem: 'AM' },
            untilDate: '2026-03-01', // expired
            lastTriggeredTimestamp: 0
        };
        const result = shouldTaskRecurNow(settings, now);
        if (result) throw new Error('Expired untilDate should not match');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 shouldRecreateRecurringTask</h4>';

    await test('shouldRecreateRecurringTask returns false when task exists', () => {
        // A valid, DUE template: `recurring` + `recurringSettings` so it passes the validity
        // guard and reaches the dedup check, and the daily-10:00 settings match `now` so it
        // WOULD recreate if absent. The old template used {taskId, settings} — wrong field
        // names, no `recurring` — so shouldRecreateRecurringTask returned false at the validity
        // guard (recurringMatcher.js:343) and never exercised the dedup: green even if the
        // dedup (line 346) were deleted.
        const template = {
            id: 'task-1',
            recurring: true,
            recurringSettings: { enabled: true, frequency: 'daily', time: { hour: 10, minute: 0, meridiem: 'AM' }, lastTriggeredTimestamp: 0 }
        };
        const now = new Date(2026, 2, 15, 10, 0);

        // Control: absent from the list, the due template SHOULD recreate.
        if (shouldRecreateRecurringTask(template, [], now) !== true) {
            throw new Error('control: a due template not already present should recreate');
        }
        // Actual assertion: present in the list → deduped → false (fails if dedup is removed).
        if (shouldRecreateRecurringTask(template, [{ id: 'task-1', text: 'Exists' }], now) !== false) {
            throw new Error('Should not recreate when task already exists');
        }
    });

    await test('shouldRecreateRecurringTask returns false when suppressed', () => {
        const now = new Date(2026, 2, 15, 10, 0);
        const dueSettings = { enabled: true, frequency: 'daily', time: { hour: 10, minute: 0, meridiem: 'AM' }, lastTriggeredTimestamp: 0 };

        // Control: a due, un-suppressed template (absent from the list) SHOULD recreate.
        const notSuppressed = { id: 'task-gone', recurring: true, recurringSettings: dueSettings };
        if (shouldRecreateRecurringTask(notSuppressed, [], now) !== true) {
            throw new Error('control: a due, un-suppressed template should recreate');
        }
        // Actual assertion: same template suppressed into the future → false (fails if the
        // suppress check at recurringMatcher.js:349 is removed). The old template short-
        // circuited at the validity guard and never reached the suppress logic.
        const suppressed = { ...notSuppressed, suppressUntil: now.getTime() + 60000 };
        if (shouldRecreateRecurringTask(suppressed, [], now) !== false) {
            throw new Error('Should not recreate when suppressed');
        }
    });

    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
