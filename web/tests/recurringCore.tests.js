/**
 * RecurringCore Module Tests
 * Tests for the recurring task scheduling engine
 */

import {
    setRecurringCoreDependencies,
    normalizeRecurringSettings,
    shouldTaskRecurNow
} from '../utilities/recurringCore.js';

export function runRecurringCoreTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔁 RecurringCore Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    function test(name, testFn) {
        total.count++;

        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === NORMALIZE SETTINGS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Settings Normalization</h4>';

    test('normalizes empty settings with defaults', () => {
        const result = normalizeRecurringSettings();

        if (result.frequency !== 'daily') {
            throw new Error('Default frequency should be daily');
        }
        if (result.indefinitely !== true) {
            throw new Error('Default indefinitely should be true');
        }
    });

    test('preserves provided frequency', () => {
        const result = normalizeRecurringSettings({ frequency: 'weekly' });

        if (result.frequency !== 'weekly') {
            throw new Error('Frequency not preserved');
        }
    });

    test('normalizes specificDates structure', () => {
        const result = normalizeRecurringSettings({
            specificDates: {
                enabled: true,
                dates: ['2025-01-01']
            }
        });

        if (!result.specificDates.enabled) {
            throw new Error('specificDates.enabled not preserved');
        }
        if (!Array.isArray(result.specificDates.dates)) {
            throw new Error('specificDates.dates should be array');
        }
        if (result.specificDates.dates[0] !== '2025-01-01') {
            throw new Error('specificDates.dates not preserved');
        }
    });

    test('creates empty arrays for missing weekly days', () => {
        const result = normalizeRecurringSettings({ frequency: 'weekly' });

        if (!Array.isArray(result.weekly.days)) {
            throw new Error('weekly.days should be array');
        }
        if (result.weekly.days.length !== 0) {
            throw new Error('weekly.days should be empty by default');
        }
    });

    test('preserves weekly days', () => {
        const result = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon', 'Wed', 'Fri'] }
        });

        if (result.weekly.days.length !== 3) {
            throw new Error('Weekly days not preserved');
        }
    });

    test('sets biweekly reference date', () => {
        const result = normalizeRecurringSettings({ frequency: 'biweekly' });

        if (!result.biweekly.referenceDate) {
            throw new Error('Biweekly reference date should be set');
        }
    });

    test('normalizes monthly days', () => {
        const result = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [1, 15, 30] }
        });

        if (result.monthly.days.length !== 3) {
            throw new Error('Monthly days not preserved');
        }
    });

    test('normalizes yearly structure', () => {
        const result = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: {
                months: [1, 6, 12],
                useSpecificDays: true,
                daysByMonth: { 1: [1] }
            }
        });

        if (result.yearly.months.length !== 3) {
            throw new Error('Yearly months not preserved');
        }
        if (!result.yearly.useSpecificDays) {
            throw new Error('useSpecificDays not preserved');
        }
    });

    test('normalizes hourly settings', () => {
        const result = normalizeRecurringSettings({
            frequency: 'hourly',
            hourly: {
                useSpecificMinute: true,
                minute: 30
            }
        });

        if (!result.hourly.useSpecificMinute) {
            throw new Error('useSpecificMinute not preserved');
        }
        if (result.hourly.minute !== 30) {
            throw new Error('Minute not preserved');
        }
    });

    test('handles time settings', () => {
        const result = normalizeRecurringSettings({
            time: { hour: 14, minute: 30, military: true }
        });

        if (!result.time) {
            throw new Error('Time settings not preserved');
        }
        if (result.time.hour !== 14) {
            throw new Error('Time hour not preserved');
        }
    });

    // === DAILY RECURRENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Daily Recurrence</h4>';

    test('daily: triggers at midnight without time', () => {
        const settings = normalizeRecurringSettings({ frequency: 'daily' });
        const testDate = new Date(2025, 0, 15, 0, 0); // Jan 15, 2025, 00:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger at midnight');
        }
    });

    test('daily: does not trigger at other times without time setting', () => {
        const settings = normalizeRecurringSettings({ frequency: 'daily' });
        const testDate = new Date(2025, 0, 15, 10, 30); // Jan 15, 2025, 10:30

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger at 10:30 without time setting');
        }
    });

    test('daily: triggers at specific time (military)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 14, minute: 30, military: true }
        });
        const testDate = new Date(2025, 0, 15, 14, 30); // Jan 15, 2025, 14:30

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger at specified time');
        }
    });

    test('daily: does not trigger at wrong time', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 14, minute: 30, military: true }
        });
        const testDate = new Date(2025, 0, 15, 14, 29); // Jan 15, 2025, 14:29

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger at wrong time');
        }
    });

    // === WEEKLY RECURRENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📆 Weekly Recurrence</h4>';

    test('weekly: triggers on correct day', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon', 'Wed', 'Fri'] }
        });
        const testDate = new Date(2025, 0, 13); // Monday, Jan 13, 2025

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Monday');
        }
    });

    test('weekly: does not trigger on wrong day', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon', 'Wed', 'Fri'] }
        });
        const testDate = new Date(2025, 0, 14); // Tuesday, Jan 14, 2025

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on Tuesday');
        }
    });

    test('weekly: respects specific time', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon'] },
            time: { hour: 9, minute: 0, military: true }
        });
        const testDate = new Date(2025, 0, 13, 9, 0); // Monday 9:00 AM

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Monday at 9:00');
        }
    });

    // === MONTHLY RECURRENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Monthly Recurrence</h4>';

    test('monthly: triggers on correct day of month', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [1, 15, 30] }
        });
        const testDate = new Date(2025, 0, 15); // Jan 15

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on 15th');
        }
    });

    test('monthly: does not trigger on wrong day', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [1, 15, 30] }
        });
        const testDate = new Date(2025, 0, 16); // Jan 16

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on 16th');
        }
    });

    test('monthly: respects specific time', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [15] },
            time: { hour: 10, minute: 0, military: true }
        });
        const testDate = new Date(2025, 0, 15, 10, 0); // Jan 15, 10:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on 15th at 10:00');
        }
    });

    // === YEARLY RECURRENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🗓️ Yearly Recurrence</h4>';

    test('yearly: triggers in correct month', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: { months: [1, 6, 12] }
        });
        const testDate = new Date(2025, 0, 15); // January (month 1)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger in January');
        }
    });

    test('yearly: does not trigger in wrong month', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: { months: [1, 6, 12] }
        });
        const testDate = new Date(2025, 1, 15); // February (month 2)

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger in February');
        }
    });

    test('yearly: with specific days', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: {
                months: [1],
                useSpecificDays: true,
                applyDaysToAll: true,
                daysByMonth: { all: [1, 15] }
            }
        });
        const testDate = new Date(2025, 0, 15); // Jan 15

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Jan 15');
        }
    });

    test('yearly: specific days per month', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: {
                months: [1, 6],
                useSpecificDays: true,
                applyDaysToAll: false,
                daysByMonth: { 1: [1], 6: [15] }
            }
        });
        const testDate = new Date(2025, 0, 1); // Jan 1

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Jan 1');
        }
    });

    // === HOURLY RECURRENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⏰ Hourly Recurrence</h4>';

    test('hourly: triggers at top of hour by default', () => {
        const settings = normalizeRecurringSettings({ frequency: 'hourly' });
        const testDate = new Date(2025, 0, 15, 10, 0); // 10:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger at top of hour');
        }
    });

    test('hourly: does not trigger at other minutes', () => {
        const settings = normalizeRecurringSettings({ frequency: 'hourly' });
        const testDate = new Date(2025, 0, 15, 10, 30); // 10:30

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger at :30');
        }
    });

    test('hourly: triggers at specific minute', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'hourly',
            hourly: { useSpecificMinute: true, minute: 30 }
        });
        const testDate = new Date(2025, 0, 15, 10, 30); // 10:30

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger at :30');
        }
    });

    // === SPECIFIC DATES TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📍 Specific Dates</h4>';

    test('specific dates: triggers on matching date', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            specificDates: {
                enabled: true,
                dates: ['2025-01-15', '2025-02-01']
            }
        });
        const testDate = new Date(2025, 0, 15); // Jan 15, 2025

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Jan 15');
        }
    });

    test('specific dates: does not trigger on non-matching date', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            specificDates: {
                enabled: true,
                dates: ['2025-01-15', '2025-02-01']
            }
        });
        const testDate = new Date(2025, 0, 16); // Jan 16, 2025

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on Jan 16');
        }
    });

    test('specific dates: respects time setting', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            specificDates: {
                enabled: true,
                dates: ['2025-01-15']
            },
            time: { hour: 14, minute: 0, military: true }
        });
        const testDate = new Date(2025, 0, 15, 14, 0); // Jan 15, 14:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Jan 15 at 14:00');
        }
    });

    test('specific dates: does not trigger at wrong time', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            specificDates: {
                enabled: true,
                dates: ['2025-01-15']
            },
            time: { hour: 14, minute: 0, military: true }
        });
        const testDate = new Date(2025, 0, 15, 13, 0); // Jan 15, 13:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger at wrong time');
        }
    });

    // === BIWEEKLY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Biweekly Recurrence</h4>';

    test('biweekly: triggers on correct week', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6, 2025 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                days: ['Mon'],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Week 0 (same week as reference)
        const testDate1 = new Date(2025, 0, 6); // Monday, Jan 6
        if (!shouldTaskRecurNow(settings, testDate1)) {
            throw new Error('Should trigger on week 0');
        }

        // Week 2 (two weeks later)
        const testDate2 = new Date(2025, 0, 20); // Monday, Jan 20
        if (!shouldTaskRecurNow(settings, testDate2)) {
            throw new Error('Should trigger on week 2');
        }
    });

    test('biweekly: does not trigger on odd weeks', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6, 2025 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                days: ['Mon'],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Week 1 (odd week - should not trigger)
        const testDate = new Date(2025, 0, 13); // Monday, Jan 13

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on odd week');
        }
    });

    test('biweekly: does not trigger on wrong day', () => {
        const referenceDate = new Date(2025, 0, 6);
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                days: ['Mon'],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Tuesday on week 0
        const testDate = new Date(2025, 0, 7); // Tuesday, Jan 7

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on Tuesday');
        }
    });

    // === 12-HOUR TO 24-HOUR CONVERSION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🕐 Time Conversion</h4>';

    test('12-hour: converts 12 AM to 0', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 12, minute: 0, meridiem: 'AM', military: false }
        });
        const testDate = new Date(2025, 0, 15, 0, 0); // 00:00 (midnight)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('12 AM should convert to 0');
        }
    });

    test('12-hour: converts 12 PM to 12', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 12, minute: 0, meridiem: 'PM', military: false }
        });
        const testDate = new Date(2025, 0, 15, 12, 0); // 12:00 (noon)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('12 PM should convert to 12');
        }
    });

    test('12-hour: converts 1 PM to 13', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 1, minute: 0, meridiem: 'PM', military: false }
        });
        const testDate = new Date(2025, 0, 15, 13, 0); // 13:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('1 PM should convert to 13');
        }
    });

    test('12-hour: converts 11 PM to 23', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 11, minute: 59, meridiem: 'PM', military: false }
        });
        const testDate = new Date(2025, 0, 15, 23, 59); // 23:59

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('11 PM should convert to 23');
        }
    });

    test('12-hour: AM hours stay the same (except 12)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 9, minute: 0, meridiem: 'AM', military: false }
        });
        const testDate = new Date(2025, 0, 15, 9, 0); // 09:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('9 AM should convert to 9');
        }
    });

    // === EDGE CASES ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Edge Cases</h4>';

    test('handles empty weekly days array', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: [] }
        });
        const testDate = new Date(2025, 0, 13); // Monday

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger with no days selected');
        }
    });

    test('handles empty monthly days array', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [] }
        });
        const testDate = new Date(2025, 0, 15);

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger with no days selected');
        }
    });

    test('handles empty yearly months array', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: { months: [] }
        });
        const testDate = new Date(2025, 0, 15);

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger with no months selected');
        }
    });

    test('handles undefined frequency', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'invalid'
        });
        const testDate = new Date(2025, 0, 15);

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger with invalid frequency');
        }
    });

    test('handles missing specificDates.dates', () => {
        const settings = normalizeRecurringSettings({
            specificDates: { enabled: true }
        });
        const testDate = new Date(2025, 0, 15);

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger with no specific dates');
        }
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
