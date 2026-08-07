/**
 * RecurringDateUtils Tests
 * Pure utility functions — no DI, no side effects
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringDateUtilsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringDateUtils.js?v=${cacheBuster}`);
    const {
        convert12To24, parseDateAsLocal, formatLocalDate, getDaysInMonth, isValidDate,
        getDaysBetween, cloneDate, isLastDayOfMonth, applyTimeToDate,
        WEEKDAY_MAP, calculateNthWeekdayOfMonth
    } = mod;

    resultsDiv.innerHTML = '<h2>RecurringDateUtils Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🕐 convert12To24</h4>';

    await test('12 AM → 0', () => {
        if (convert12To24(12, 'AM') !== 0) throw new Error('12 AM should be 0');
    });
    await test('12 PM → 12', () => {
        if (convert12To24(12, 'PM') !== 12) throw new Error('12 PM should be 12');
    });
    await test('1 AM → 1', () => {
        if (convert12To24(1, 'AM') !== 1) throw new Error('1 AM should be 1');
    });
    await test('1 PM → 13', () => {
        if (convert12To24(1, 'PM') !== 13) throw new Error('1 PM should be 13');
    });
    await test('11 PM → 23', () => {
        if (convert12To24(11, 'PM') !== 23) throw new Error('11 PM should be 23');
    });
    await test('11 AM → 11', () => {
        if (convert12To24(11, 'AM') !== 11) throw new Error('11 AM should be 11');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📅 parseDateAsLocal</h4>';

    await test('parses YYYY-MM-DD as local date', () => {
        const d = parseDateAsLocal('2026-03-15');
        if (d.getFullYear() !== 2026 || d.getMonth() !== 2 || d.getDate() !== 15) {
            throw new Error(`Parsed wrong: ${d}`);
        }
    });
    await test('returns local midnight', () => {
        const d = parseDateAsLocal('2026-01-01');
        if (d.getHours() !== 0 || d.getMinutes() !== 0) {
            throw new Error('Should be midnight local');
        }
    });
    await test('returns null for non-strings without hitting the catch', () => {
        // Non-strings always resolved to null, but used to do so by throwing
        // inside the try and logging a stack trace. The type guard must handle
        // them before the try — so assert on console.error, not just the
        // return value (a null-only check passes with the guard deleted).
        const originalError = console.error;
        let errorCalls = 0;
        console.error = () => { errorCalls++; };
        try {
            for (const bad of [null, undefined, 0, 20260315, {}, [], true]) {
                const result = parseDateAsLocal(bad);
                if (result !== null) {
                    throw new Error(`Expected null for ${JSON.stringify(bad)}, got ${result}`);
                }
            }
        } finally {
            console.error = originalError;
        }
        if (errorCalls !== 0) {
            throw new Error(`Non-strings should not log; console.error called ${errorCalls}x`);
        }
    });
    await test('still returns null and logs for unparsable strings', () => {
        // The guard must not swallow the existing invalid-string path.
        const originalError = console.error;
        let errorCalls = 0;
        console.error = () => { errorCalls++; };
        let result;
        try {
            result = parseDateAsLocal('not-a-date');
        } finally {
            console.error = originalError;
        }
        if (result !== null) throw new Error(`Expected null, got ${result}`);
        if (errorCalls === 0) throw new Error('Invalid date string should still log');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📅 formatLocalDate</h4>';

    await test('formats a Date as its LOCAL calendar day', () => {
        const d = new Date(2026, 7, 6); // Aug 6 2026, local midnight
        if (formatLocalDate(d) !== '2026-08-06') {
            throw new Error(`Expected 2026-08-06, got ${formatLocalDate(d)}`);
        }
    });

    await test('zero-pads single-digit months and days', () => {
        if (formatLocalDate(new Date(2026, 0, 5)) !== '2026-01-05') {
            throw new Error(`Expected 2026-01-05, got ${formatLocalDate(new Date(2026, 0, 5))}`);
        }
    });

    await test('late-evening local time keeps the LOCAL day, not the UTC one', () => {
        // The actual bug this closes. In any negative UTC offset a late-evening
        // local time is already tomorrow in UTC, so toISOString() (and
        // input.valueAsDate, which uses the same rule) reports the wrong day.
        // Measured Aug 2026: from 20:00 EDT onward the recurring specific-date
        // input defaulted TWO days out.
        const d = new Date(2026, 7, 6, 23, 30); // Aug 6, 23:30 LOCAL
        const local = formatLocalDate(d);
        if (local !== '2026-08-06') {
            throw new Error(`Expected 2026-08-06, got ${local}`);
        }
        // Assert the divergence directly where the runner's zone has one, so
        // this test carries meaning outside UTC CI rather than silently passing.
        const utc = d.toISOString().split('T')[0];
        if (d.getTimezoneOffset() > 0 && utc === local) {
            throw new Error('expected toISOString to disagree in a negative UTC offset');
        }
    });

    await test('round-trips with parseDateAsLocal', () => {
        const original = '2026-12-31';
        const round = formatLocalDate(parseDateAsLocal(original));
        if (round !== original) throw new Error(`Round trip broke: ${original} -> ${round}`);
    });

    await test('returns null for non-Dates and Invalid Date', () => {
        for (const bad of [null, undefined, '2026-08-06', 0, {}, [], new Date('nope')]) {
            if (formatLocalDate(bad) !== null) {
                throw new Error(`Expected null for ${JSON.stringify(bad)}, got ${formatLocalDate(bad)}`);
            }
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📆 getDaysInMonth</h4>';

    await test('January has 31 days', () => {
        if (getDaysInMonth(0, 2026) !== 31) throw new Error('Jan should be 31');
    });
    await test('February 2024 (leap) has 29 days', () => {
        if (getDaysInMonth(1, 2024) !== 29) throw new Error('Feb 2024 should be 29');
    });
    await test('February 2025 (non-leap) has 28 days', () => {
        if (getDaysInMonth(1, 2025) !== 28) throw new Error('Feb 2025 should be 28');
    });
    await test('April has 30 days', () => {
        if (getDaysInMonth(3, 2026) !== 30) throw new Error('Apr should be 30');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ isValidDate</h4>';

    await test('valid date returns true', () => {
        if (!isValidDate(2026, 2, 15)) throw new Error('Mar 15 should be valid');
    });
    await test('Feb 30 returns false', () => {
        if (isValidDate(2026, 1, 30)) throw new Error('Feb 30 should be invalid');
    });
    await test('Feb 29 leap year returns true', () => {
        if (!isValidDate(2024, 1, 29)) throw new Error('Feb 29 2024 should be valid');
    });
    await test('Feb 29 non-leap returns false', () => {
        if (isValidDate(2025, 1, 29)) throw new Error('Feb 29 2025 should be invalid');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📏 getDaysBetween</h4>';

    await test('same day returns 0', () => {
        const d = new Date(2026, 2, 15);
        if (getDaysBetween(d, d) !== 0) throw new Error('Same day should be 0');
    });
    await test('one day apart returns 1', () => {
        const d1 = new Date(2026, 2, 15);
        const d2 = new Date(2026, 2, 16);
        if (getDaysBetween(d1, d2) !== 1) throw new Error('Should be 1 day');
    });
    await test('handles month boundary', () => {
        const d1 = new Date(2026, 0, 31);
        const d2 = new Date(2026, 1, 1);
        if (getDaysBetween(d1, d2) !== 1) throw new Error('Jan 31 to Feb 1 should be 1');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 cloneDate & isLastDayOfMonth</h4>';

    await test('cloneDate creates independent copy', () => {
        const d1 = new Date(2026, 2, 15);
        const d2 = cloneDate(d1);
        d2.setDate(20);
        if (d1.getDate() !== 15) throw new Error('Original should be unchanged');
    });
    await test('isLastDayOfMonth true for Jan 31', () => {
        if (!isLastDayOfMonth(new Date(2026, 0, 31))) throw new Error('Jan 31 is last day');
    });
    await test('isLastDayOfMonth false for Jan 30', () => {
        if (isLastDayOfMonth(new Date(2026, 0, 30))) throw new Error('Jan 30 is not last day');
    });
    await test('isLastDayOfMonth true for Feb 28 non-leap', () => {
        if (!isLastDayOfMonth(new Date(2025, 1, 28))) throw new Error('Feb 28 2025 is last day');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⏰ applyTimeToDate</h4>';

    await test('applies hour and minute', () => {
        const d = new Date(2026, 2, 15, 0, 0, 0);
        applyTimeToDate(d, { hour: 3, minute: 30, meridiem: 'PM' });
        if (d.getHours() !== 15 || d.getMinutes() !== 30) {
            throw new Error(`Expected 15:30, got ${d.getHours()}:${d.getMinutes()}`);
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📅 WEEKDAY_MAP & calculateNthWeekdayOfMonth</h4>';

    await test('WEEKDAY_MAP has 7 entries', () => {
        if (Object.keys(WEEKDAY_MAP).length !== 7) throw new Error('Should have 7 weekdays');
    });
    await test('WEEKDAY_MAP Sun=0, Sat=6', () => {
        if (WEEKDAY_MAP['Sun'] !== 0 || WEEKDAY_MAP['Sat'] !== 6) {
            throw new Error('Sun should be 0, Sat should be 6');
        }
    });
    await test('calculateNthWeekdayOfMonth finds 1st Monday', () => {
        // March 2026: 1st is Sunday, so 1st Monday is March 2
        const d = calculateNthWeekdayOfMonth(2026, 2, 1, 1); // year, month(0-idx), weekday(Mon=1), ordinal(1st)
        if (d && d.getDate() !== 2) throw new Error(`Expected 2nd, got ${d?.getDate()}`);
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
