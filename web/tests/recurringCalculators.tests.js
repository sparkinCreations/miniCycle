/**
 * RecurringCalculators Tests
 * Tests for next occurrence calculation across all frequency types
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringCalculatorsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringCalculators.js?v=${cacheBuster}`);
    const {
        calculateNextOccurrence, calculateNextOccurrences, formatNextOccurrence,
        calculateNextDaily, calculateNextWeekly, calculateNextHourly,
        setDateUtils, setNormalizer, setLabelResolver
    } = mod;

    const dateUtilsMod = await import(`../modules/recurring/recurringDateUtils.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringCalculators Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Inject real date utils
    setDateUtils(dateUtilsMod);
    setNormalizer((s) => ({ ...s, _normalized: true }));
    setLabelResolver((key) => key); // passthrough

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('calculateNextOccurrence is exported', () => {
        if (typeof calculateNextOccurrence !== 'function') throw new Error('Missing');
    });

    await test('calculateNextOccurrences is exported', () => {
        if (typeof calculateNextOccurrences !== 'function') throw new Error('Missing');
    });

    await test('formatNextOccurrence is exported', () => {
        if (typeof formatNextOccurrence !== 'function') throw new Error('Missing');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📅 calculateNextDaily</h4>';

    await test('next daily is tomorrow when today already passed', () => {
        const from = new Date(2026, 2, 15, 12, 0); // March 15, noon
        const timeSettings = { hour: 8, minute: 0, meridiem: 'AM' }; // 8 AM — already passed
        const result = calculateNextDaily(timeSettings, from);
        if (!result) throw new Error('Should return a timestamp');
        const next = new Date(result);
        if (next.getDate() !== 16) throw new Error(`Expected 16th, got ${next.getDate()}`);
    });

    await test('next daily is today when time not yet passed', () => {
        const from = new Date(2026, 2, 15, 6, 0); // 6 AM
        const timeSettings = { hour: 8, minute: 0, meridiem: 'AM' }; // 8 AM — not yet
        const result = calculateNextDaily(timeSettings, from);
        if (!result) throw new Error('Should return a timestamp');
        const next = new Date(result);
        if (next.getDate() !== 15) throw new Error(`Expected 15th, got ${next.getDate()}`);
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📅 calculateNextWeekly</h4>';

    await test('next weekly calculates future weekday', () => {
        const from = new Date(2026, 2, 15, 12, 0); // Sunday March 15
        const weeklySettings = { days: ['Mon'] };
        const timeSettings = { hour: 9, minute: 0, meridiem: 'AM' };
        const result = calculateNextWeekly(weeklySettings, timeSettings, from);
        if (!result) throw new Error('Should return a timestamp');
        const next = new Date(result);
        if (next.getDay() !== 1) throw new Error(`Expected Monday (1), got ${next.getDay()}`);
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 calculateNextOccurrence</h4>';

    await test('calculateNextOccurrence handles daily frequency', () => {
        const settings = {
            enabled: true,
            frequency: 'daily',
            time: { hour: 9, minute: 0, meridiem: 'AM' }
        };
        const result = calculateNextOccurrence(settings);
        if (!result || typeof result !== 'number') throw new Error('Should return timestamp');
        if (result < Date.now()) throw new Error('Should be in the future');
    });

    await test('calculateNextOccurrence ignores `enabled` — it computes from frequency (gating is the caller\'s job)', () => {
        // Pins the REAL contract. calculateNextOccurrence (recurringCalculators.js) does
        // NOT gate on settings.enabled — whether a task is active is decided by the caller
        // (the recurring watcher), so a disabled+daily setting still yields the next daily
        // timestamp. The old test was named "returns null for disabled" and hollowed its
        // only assertion (`if (result !== null && result !== undefined) { /* comment */ }`),
        // silently accepting the real return (a timestamp) and hiding that the name was a fiction.
        const settings = { enabled: false, frequency: 'daily', time: { hour: 9, minute: 0, meridiem: 'AM' } };
        const result = calculateNextOccurrence(settings);
        if (typeof result !== 'number') {
            throw new Error(`expected a timestamp (enabled is ignored at this layer), got ${result}`);
        }
        if (result < Date.now()) {
            throw new Error('next daily occurrence should be in the future');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 calculateNextOccurrences</h4>';

    await test('calculateNextOccurrences returns array', () => {
        const settings = {
            enabled: true,
            frequency: 'daily',
            time: { hour: 9, minute: 0, meridiem: 'AM' }
        };
        const result = calculateNextOccurrences(settings, 3);
        if (!Array.isArray(result)) throw new Error('Should return array');
        if (result.length === 0) throw new Error('Should have occurrences');
    });

    await test('calculateNextOccurrences returns ascending timestamps', () => {
        const settings = {
            enabled: true,
            frequency: 'daily',
            time: { hour: 9, minute: 0, meridiem: 'AM' }
        };
        const result = calculateNextOccurrences(settings, 3);
        for (let i = 1; i < result.length; i++) {
            if (result[i] <= result[i - 1]) throw new Error('Timestamps should be ascending');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ formatNextOccurrence</h4>';

    await test('formatNextOccurrence returns string', () => {
        const ts = Date.now() + 86400000; // tomorrow
        const result = formatNextOccurrence(ts);
        if (typeof result !== 'string') throw new Error('Should return string');
        if (result.length === 0) throw new Error('Should not be empty');
    });

    await test('formatNextOccurrence handles null', () => {
        const result = formatNextOccurrence(null);
        if (typeof result !== 'string') throw new Error('Should return string for null');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏁 End date (untilDate) clamp</h4>';

    // Recurring review Finding A: the calculator must never schedule an
    // occurrence past settings.untilDate — an unclamped next occurrence past
    // the end date makes catch-up (which trusts timestamps and skips the
    // matcher) resurrect the task every session, forever.
    await test('calculateNextOccurrence returns null when next would land past untilDate', () => {
        // From the end date itself: daily-no-time schedules start of TOMORROW,
        // which is past end-of-day on the untilDate.
        const from = new Date(2026, 7, 9, 12, 0, 0); // Aug 9 2026, noon (local)
        const result = calculateNextOccurrence(
            { frequency: 'daily', indefinitely: false, untilDate: '2026-08-09' },
            from.getTime()
        );
        if (result !== null) {
            throw new Error(`Expected null past end date, got ${new Date(result)}`);
        }
    });

    await test('calculateNextOccurrence keeps the final pre-end occurrence scheduled', () => {
        // From the day BEFORE the end date: next daily occurrence lands ON the
        // untilDate (start of day), inside the end-of-day boundary — still owed.
        const from = new Date(2026, 7, 8, 12, 0, 0); // Aug 8 2026, noon (local)
        const result = calculateNextOccurrence(
            { frequency: 'daily', indefinitely: false, untilDate: '2026-08-09' },
            from.getTime()
        );
        const expected = new Date(2026, 7, 9, 0, 0, 0, 0).getTime();
        if (result !== expected) {
            throw new Error(`Expected ${new Date(expected)}, got ${result === null ? 'null' : new Date(result)}`);
        }
    });

    await test('calculateNextOccurrences preview stops at untilDate', () => {
        const from = new Date(2026, 7, 7, 12, 0, 0); // Aug 7 2026 — 2 days left
        const result = calculateNextOccurrences(
            { frequency: 'daily', indefinitely: false, untilDate: '2026-08-09' },
            5,
            from.getTime()
        );
        // Only Aug 8 and Aug 9 remain before the end date.
        if (result.length !== 2) {
            throw new Error(`Preview should stop at the end date (expected 2 occurrences, got ${result.length})`);
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
