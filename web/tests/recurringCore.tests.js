/**
 * RecurringCore Module Tests
 * Tests for the recurring task scheduling engine
 */

import {
    setRecurringCoreDependencies,
    normalizeRecurringSettings,
    shouldTaskRecurNow,
    calculateNextOccurrence,
    calculateNextOccurrences,
    formatNextOccurrence
} from '../modules/recurring/recurringCore.js';

export function runRecurringCoreTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔁 RecurringCore Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
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

    test('daily: triggers at any time without specific time (midnight)', () => {
        const settings = normalizeRecurringSettings({ frequency: 'daily' });
        const testDate = new Date(2025, 0, 15, 0, 0); // Jan 15, 2025, 00:00

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger at midnight');
        }
    });

    test('daily: triggers at any time without specific time (10:30 AM)', () => {
        const settings = normalizeRecurringSettings({ frequency: 'daily' });
        const testDate = new Date(2025, 0, 15, 10, 30); // Jan 15, 2025, 10:30

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('✅ FIX: Should trigger at 10:30 without time setting (relies on lastTriggeredTimestamp to prevent duplicates)');
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

    test('biweekly: triggers on correct week (Week 1)', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6, 2025 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Mon'],
                week2: [],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Week 0 (same week as reference = Week 1)
        const testDate1 = new Date(2025, 0, 6); // Monday, Jan 6
        if (!shouldTaskRecurNow(settings, testDate1)) {
            throw new Error('Should trigger on week 0 (Week 1)');
        }

        // Week 2 (two weeks later = Week 1 again)
        const testDate2 = new Date(2025, 0, 20); // Monday, Jan 20
        if (!shouldTaskRecurNow(settings, testDate2)) {
            throw new Error('Should trigger on week 2 (Week 1)');
        }
    });

    test('biweekly: does not trigger on Week 2 when only Week 1 has days', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6, 2025 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Mon'],
                week2: [],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Week 1 (odd week = Week 2 - should not trigger since Week 2 is empty)
        const testDate = new Date(2025, 0, 13); // Monday, Jan 13

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on Week 2 when Week 2 is empty');
        }
    });

    test('biweekly: does not trigger on wrong day', () => {
        const referenceDate = new Date(2025, 0, 6);
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Mon'],
                week2: [],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Tuesday on week 0 (Week 1)
        const testDate = new Date(2025, 0, 7); // Tuesday, Jan 7

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger on Tuesday when only Monday is selected');
        }
    });

    test('biweekly: two-week pattern - different days each week', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Mon', 'Wed'],
                week2: ['Tue', 'Thu'],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Week 1 (week 0): Monday should trigger
        const week1Mon = new Date(2025, 0, 6); // Mon, Jan 6
        if (!shouldTaskRecurNow(settings, week1Mon)) {
            throw new Error('Should trigger on Week 1 Monday');
        }

        // Week 1 (week 0): Wednesday should trigger
        const week1Wed = new Date(2025, 0, 8); // Wed, Jan 8
        if (!shouldTaskRecurNow(settings, week1Wed)) {
            throw new Error('Should trigger on Week 1 Wednesday');
        }

        // Week 1 (week 0): Tuesday should NOT trigger
        const week1Tue = new Date(2025, 0, 7); // Tue, Jan 7
        if (shouldTaskRecurNow(settings, week1Tue)) {
            throw new Error('Should NOT trigger on Week 1 Tuesday');
        }

        // Week 2 (week 1): Tuesday should trigger
        const week2Tue = new Date(2025, 0, 14); // Tue, Jan 14
        if (!shouldTaskRecurNow(settings, week2Tue)) {
            throw new Error('Should trigger on Week 2 Tuesday');
        }

        // Week 2 (week 1): Thursday should trigger
        const week2Thu = new Date(2025, 0, 16); // Thu, Jan 16
        if (!shouldTaskRecurNow(settings, week2Thu)) {
            throw new Error('Should trigger on Week 2 Thursday');
        }

        // Week 2 (week 1): Monday should NOT trigger
        const week2Mon = new Date(2025, 0, 13); // Mon, Jan 13
        if (shouldTaskRecurNow(settings, week2Mon)) {
            throw new Error('Should NOT trigger on Week 2 Monday');
        }
    });

    test('biweekly: DST transition does not affect week calculation', () => {
        // DST 2025: Spring forward on March 9 (2 AM -> 3 AM)
        const referenceDate = new Date(2025, 2, 3); // Monday, March 3 (week 0, before DST)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Mon'],
                week2: [],
                referenceDate: referenceDate.toISOString()
            }
        });

        // Week 0 (before DST): Monday should trigger
        const beforeDST = new Date(2025, 2, 3); // Mon, March 3
        if (!shouldTaskRecurNow(settings, beforeDST)) {
            throw new Error('Should trigger before DST');
        }

        // Week 2 (after DST): Monday should still trigger (despite DST)
        const afterDST = new Date(2025, 2, 17); // Mon, March 17 (after DST)
        if (!shouldTaskRecurNow(settings, afterDST)) {
            throw new Error('Should trigger after DST on same week pattern');
        }

        // Week 4 (well after DST): Monday should still trigger
        const wellAfterDST = new Date(2025, 2, 31); // Mon, March 31
        if (!shouldTaskRecurNow(settings, wellAfterDST)) {
            throw new Error('Should trigger well after DST on same week pattern');
        }
    });

    test('biweekly: calculates next occurrence with two-week pattern', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Wed'],
                week2: ['Tue'],
                referenceDate: referenceDate.toISOString()
            }
        });

        // From Week 1 Wednesday - next should be Week 2 Tuesday
        const from = new Date(2025, 0, 8); // Wed, Jan 8 (week 0 = Week 1)
        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        const weekday = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (weekday !== 'Tue') {
            throw new Error(`Expected Tue, got ${weekday}`);
        }
        if (nextDate.getDate() !== 14) {
            throw new Error(`Expected 14, got ${nextDate.getDate()}`);
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

    test('✅ FIX: empty weekly days array allows all days', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: [] }
        });
        const testDate = new Date(2025, 0, 13); // Monday

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('✅ FIX: Should trigger on any day when no specific days selected');
        }
    });

    test('✅ FIX: empty monthly days array allows all days', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [] }
        });
        const testDate = new Date(2025, 0, 15);

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('✅ FIX: Should trigger on any day when no specific days selected');
        }
    });

    test('✅ FIX: empty yearly months array allows all months', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: { months: [] }
        });
        const testDate = new Date(2025, 0, 15);

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('✅ FIX: Should trigger in any month when no specific months selected');
        }
    });

    test('empty biweekly week1 and week2 arrays do not trigger', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: [],
                week2: [],
                referenceDate: referenceDate.toISOString()
            }
        });
        const testDate = new Date(2025, 0, 6); // Monday, week 0

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should not trigger when both week1 and week2 are empty');
        }
    });

    test('✅ FIX: yearly with useSpecificDays but empty days array allows all days', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: {
                months: [1],
                useSpecificDays: true,
                applyDaysToAll: true,
                daysByMonth: { all: [] }
            }
        });
        const testDate = new Date(2025, 0, 15); // Jan 15

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('✅ FIX: Should trigger on any day when useSpecificDays enabled but no days selected');
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

    // === NEXT OCCURRENCE CALCULATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔮 Next Occurrence Calculation</h4>';

    test('calculates next daily occurrence (no time)', () => {
        const settings = normalizeRecurringSettings({ frequency: 'daily' });
        const from = new Date(2025, 0, 15, 10, 30); // Jan 15, 10:30 AM

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be tomorrow at midnight
        if (nextDate.getDate() !== 16) {
            throw new Error(`Expected Jan 16, got ${nextDate.getDate()}`);
        }
        if (nextDate.getHours() !== 0 || nextDate.getMinutes() !== 0) {
            throw new Error('Should be at midnight');
        }
    });

    test('calculates next daily occurrence (with time)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 9, minute: 0, military: true }
        });
        const from = new Date(2025, 0, 15, 10, 30); // Jan 15, 10:30 AM (after 9 AM)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be tomorrow at 9 AM
        if (nextDate.getDate() !== 16) {
            throw new Error(`Expected Jan 16, got ${nextDate.getDate()}`);
        }
        if (nextDate.getHours() !== 9 || nextDate.getMinutes() !== 0) {
            throw new Error(`Expected 9:00, got ${nextDate.getHours()}:${nextDate.getMinutes()}`);
        }
    });

    test('calculates next daily occurrence (before time today)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 14, minute: 30, military: true }
        });
        const from = new Date(2025, 0, 15, 10, 0); // Jan 15, 10:00 AM (before 2:30 PM)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be today at 2:30 PM
        if (nextDate.getDate() !== 15) {
            throw new Error('Should be today');
        }
        if (nextDate.getHours() !== 14 || nextDate.getMinutes() !== 30) {
            throw new Error('Should be at 14:30');
        }
    });

    test('calculates next weekly occurrence', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon', 'Wed', 'Fri'] },
            time: { hour: 9, minute: 0, military: true }
        });
        const from = new Date(2025, 0, 13, 10, 0); // Monday Jan 13, 10:00 AM (after 9 AM)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Wednesday Jan 15 at 9 AM
        const weekday = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (weekday !== 'Wed') {
            throw new Error(`Expected Wed, got ${weekday}`);
        }
        if (nextDate.getDate() !== 15) {
            throw new Error(`Expected 15, got ${nextDate.getDate()}`);
        }
    });

    test('calculates next monthly occurrence', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [1, 15, 30] },
            time: { hour: 10, minute: 0, military: true }
        });
        const from = new Date(2025, 0, 10, 12, 0); // Jan 10, noon

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Jan 15 at 10 AM
        if (nextDate.getDate() !== 15) {
            throw new Error(`Expected 15, got ${nextDate.getDate()}`);
        }
        if (nextDate.getMonth() !== 0) {
            throw new Error('Should be in January');
        }
    });

    test('calculates next monthly occurrence (next month)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: { days: [1, 15] }
        });
        const from = new Date(2025, 0, 20); // Jan 20 (after 15th)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Feb 1
        if (nextDate.getMonth() !== 1) {
            throw new Error('Should be in February');
        }
        if (nextDate.getDate() !== 1) {
            throw new Error(`Expected 1, got ${nextDate.getDate()}`);
        }
    });

    test('calculates next yearly occurrence', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: {
                months: [1, 6, 12],
                useSpecificDays: true,
                applyDaysToAll: true,
                daysByMonth: { all: [1, 15] }
            }
        });
        const from = new Date(2025, 0, 10); // Jan 10

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Jan 15
        if (nextDate.getMonth() !== 0) {
            throw new Error('Should be in January');
        }
        if (nextDate.getDate() !== 15) {
            throw new Error(`Expected 15, got ${nextDate.getDate()}`);
        }
    });

    test('calculates next yearly occurrence (next year)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'yearly',
            yearly: {
                months: [1],
                useSpecificDays: true,
                applyDaysToAll: true,
                daysByMonth: { all: [1] }
            }
        });
        const from = new Date(2025, 6, 15); // Jul 15 (after Jan 1)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Jan 1, 2026
        if (nextDate.getFullYear() !== 2026) {
            throw new Error('Should be in 2026');
        }
        if (nextDate.getMonth() !== 0 || nextDate.getDate() !== 1) {
            throw new Error('Should be Jan 1');
        }
    });

    test('calculates next hourly occurrence (top of hour)', () => {
        const settings = normalizeRecurringSettings({ frequency: 'hourly' });
        const from = new Date(2025, 0, 15, 10, 30); // 10:30

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be 11:00
        if (nextDate.getHours() !== 11 || nextDate.getMinutes() !== 0) {
            throw new Error('Should be at 11:00');
        }
    });

    test('calculates next hourly occurrence (specific minute)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'hourly',
            hourly: { useSpecificMinute: true, minute: 30 }
        });
        const from = new Date(2025, 0, 15, 10, 45); // 10:45

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be 11:30
        if (nextDate.getHours() !== 11 || nextDate.getMinutes() !== 30) {
            throw new Error(`Expected 11:30, got ${nextDate.getHours()}:${nextDate.getMinutes()}`);
        }
    });

    test('calculates next biweekly occurrence', () => {
        const referenceDate = new Date(2025, 0, 6); // Monday, Jan 6 (week 0)
        const settings = normalizeRecurringSettings({
            frequency: 'biweekly',
            biweekly: {
                week1: ['Mon', 'Wed'],
                week2: [],
                referenceDate: referenceDate.toISOString()
            }
        });
        const from = new Date(2025, 0, 8); // Wed, Jan 8 (week 0 = Week 1)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Mon, Jan 20 (week 2 = Week 1 again)
        const weekday = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (weekday !== 'Mon') {
            throw new Error(`Expected Mon, got ${weekday}`);
        }
        if (nextDate.getDate() !== 20) {
            throw new Error(`Expected 20, got ${nextDate.getDate()}`);
        }
    });

    test('calculates next specific date occurrence', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            specificDates: {
                enabled: true,
                dates: ['2025-01-20', '2025-02-01', '2025-02-15']
            },
            time: { hour: 9, minute: 0, military: true }
        });
        const from = new Date(2025, 0, 15); // Jan 15

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Jan 20
        if (nextDate.getDate() !== 20 || nextDate.getMonth() !== 0) {
            throw new Error('Should be Jan 20');
        }
        if (nextDate.getHours() !== 9) {
            throw new Error('Should be at 9 AM');
        }
    });

    test('returns null for specific dates with no future dates', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            specificDates: {
                enabled: true,
                dates: ['2025-01-01', '2025-01-05']
            }
        });
        const from = new Date(2025, 0, 20); // Jan 20 (after all dates)

        const next = calculateNextOccurrence(settings, from);

        if (next !== null) {
            throw new Error('Should return null when no future dates');
        }
    });

    test('handles month boundary correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 23, minute: 59, military: true }
        });
        const from = new Date(2025, 0, 31, 23, 59); // Jan 31, 23:59 (last minute)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Feb 1, 23:59
        if (nextDate.getMonth() !== 1) {
            throw new Error('Should be in February');
        }
        if (nextDate.getDate() !== 1) {
            throw new Error('Should be Feb 1');
        }
    });

    test('handles year boundary correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily'
        });
        const from = new Date(2025, 11, 31, 23, 59); // Dec 31, 2025, 23:59

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be Jan 1, 2026
        if (nextDate.getFullYear() !== 2026) {
            throw new Error('Should be in 2026');
        }
        if (nextDate.getMonth() !== 0 || nextDate.getDate() !== 1) {
            throw new Error('Should be Jan 1');
        }
    });

    test('handles 12-hour time format (AM)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 9, minute: 30, meridiem: 'AM', military: false }
        });
        const from = new Date(2025, 0, 15, 10, 0); // After 9:30 AM

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be tomorrow at 9:30 AM
        if (nextDate.getDate() !== 16) {
            throw new Error('Should be tomorrow');
        }
        if (nextDate.getHours() !== 9 || nextDate.getMinutes() !== 30) {
            throw new Error('Should be at 9:30 AM');
        }
    });

    test('handles 12-hour time format (PM)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 2, minute: 30, meridiem: 'PM', military: false }
        });
        const from = new Date(2025, 0, 15, 10, 0); // Before 2:30 PM

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be today at 2:30 PM (14:30)
        if (nextDate.getDate() !== 15) {
            throw new Error('Should be today');
        }
        if (nextDate.getHours() !== 14 || nextDate.getMinutes() !== 30) {
            throw new Error('Should be at 14:30 (2:30 PM)');
        }
    });

    test('handles 12 AM (midnight)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 12, minute: 0, meridiem: 'AM', military: false }
        });
        const from = new Date(2025, 0, 15, 10, 0); // After midnight

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be tomorrow at midnight (00:00)
        if (nextDate.getDate() !== 16) {
            throw new Error('Should be tomorrow');
        }
        if (nextDate.getHours() !== 0) {
            throw new Error('12 AM should be hour 0');
        }
    });

    test('handles 12 PM (noon)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            time: { hour: 12, minute: 0, meridiem: 'PM', military: false }
        });
        const from = new Date(2025, 0, 15, 10, 0); // Before noon

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be today at noon (12:00)
        if (nextDate.getDate() !== 15) {
            throw new Error('Should be today');
        }
        if (nextDate.getHours() !== 12) {
            throw new Error('12 PM should be hour 12');
        }
    });

    test('calculates multiple future occurrences', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon'] },
            time: { hour: 9, minute: 0, military: true }
        });
        const from = new Date(2025, 0, 13, 10, 0); // Monday Jan 13, after 9 AM

        const occurrences = calculateNextOccurrences(settings, 3, from);

        if (occurrences.length !== 3) {
            throw new Error(`Expected 3 occurrences, got ${occurrences.length}`);
        }

        // Should be next 3 Mondays
        const dates = occurrences.map(ts => new Date(ts));

        // First: Jan 20
        if (dates[0].getDate() !== 20) {
            throw new Error(`Expected Jan 20, got ${dates[0].getDate()}`);
        }

        // Second: Jan 27
        if (dates[1].getDate() !== 27) {
            throw new Error(`Expected Jan 27, got ${dates[1].getDate()}`);
        }

        // Third: Feb 3
        if (dates[2].getMonth() !== 1 || dates[2].getDate() !== 3) {
            throw new Error('Expected Feb 3');
        }
    });

    test('formats next occurrence (minutes)', () => {
        const now = Date.now();
        const next = now + (45 * 60 * 1000); // 45 minutes from now

        const formatted = formatNextOccurrence(next);

        // Allow ±1 minute variance due to timing in CI environments
        if (!formatted.includes('44 minute') && !formatted.includes('45 minute')) {
            throw new Error(`Expected "44 or 45 minutes", got "${formatted}"`);
        }
    });

    test('formats next occurrence (hours)', () => {
        const now = Date.now();
        const next = now + (3 * 60 * 60 * 1000); // 3 hours from now

        const formatted = formatNextOccurrence(next);

        if (!formatted.includes('3 hour')) {
            throw new Error(`Expected "3 hours", got "${formatted}"`);
        }
    });

    test('formats next occurrence (days)', () => {
        const now = Date.now();
        const next = now + (2 * 24 * 60 * 60 * 1000); // 2 days from now

        const formatted = formatNextOccurrence(next);

        // ✅ Updated: Now shows specific day name and time (better UX)
        // Should show "Next: [Weekday] at [time]" format for dates beyond 24 hours
        if (!formatted.includes('Next:') || !formatted.includes('at')) {
            throw new Error(`Expected "Next: [Weekday] at [time]", got "${formatted}"`);
        }
    });

    test('formats next occurrence (far future)', () => {
        const now = Date.now();
        const next = now + (10 * 24 * 60 * 60 * 1000); // 10 days from now

        const formatted = formatNextOccurrence(next);

        if (!formatted.includes('Next:')) {
            throw new Error(`Expected date format with "Next:", got "${formatted}"`);
        }
    });

    test('formats null occurrence', () => {
        const formatted = formatNextOccurrence(null);

        if (formatted !== 'No upcoming occurrences') {
            throw new Error('Should show "No upcoming occurrences"');
        }
    });

    test('formats overdue occurrence', () => {
        const now = Date.now();
        const past = now - (60 * 60 * 1000); // 1 hour ago

        const formatted = formatNextOccurrence(past);

        if (formatted !== 'Overdue') {
            throw new Error('Should show "Overdue"');
        }
    });

    // === MONTHLY WEEK-OF-MONTH PATTERN TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Monthly Week-of-Month Pattern</h4>';

    test('monthly week-of-month: 1st Monday triggers correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useWeekOfMonth: true,
                weekOfMonth: { ordinal: '1', day: 'Mon' }
            }
        });
        // January 2025: 1st Monday is Jan 6
        const testDate = new Date(2025, 0, 6); // Jan 6, 2025 (Monday)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on 1st Monday (Jan 6)');
        }
    });

    test('monthly week-of-month: 2nd Tuesday triggers correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useWeekOfMonth: true,
                weekOfMonth: { ordinal: '2', day: 'Tue' }
            }
        });
        // January 2025: 2nd Tuesday is Jan 14
        const testDate = new Date(2025, 0, 14); // Jan 14, 2025 (Tuesday)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on 2nd Tuesday (Jan 14)');
        }
    });

    test('monthly week-of-month: Last Friday triggers correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useWeekOfMonth: true,
                weekOfMonth: { ordinal: 'last', day: 'Fri' }
            }
        });
        // January 2025: Last Friday is Jan 31
        const testDate = new Date(2025, 0, 31); // Jan 31, 2025 (Friday)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on Last Friday (Jan 31)');
        }
    });

    test('monthly week-of-month: does not trigger on wrong day', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useWeekOfMonth: true,
                weekOfMonth: { ordinal: '1', day: 'Mon' }
            }
        });
        // January 2025: 1st Monday is Jan 6, testing Jan 13 (2nd Monday)
        const testDate = new Date(2025, 0, 13); // Jan 13, 2025 (2nd Monday)

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should NOT trigger on 2nd Monday when pattern is 1st Monday');
        }
    });

    test('monthly week-of-month: calculates next occurrence correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useWeekOfMonth: true,
                weekOfMonth: { ordinal: '2', day: 'Wed' }
            },
            time: { hour: 10, minute: 0, military: true }
        });
        // January 2025: 2nd Wednesday is Jan 8
        const from = new Date(2025, 0, 9, 12, 0); // Jan 9, noon (day after 2nd Wed)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be February's 2nd Wednesday (Feb 12)
        if (nextDate.getMonth() !== 1) {
            throw new Error(`Expected February, got month ${nextDate.getMonth()}`);
        }
        if (nextDate.getDate() !== 12) {
            throw new Error(`Expected 12th, got ${nextDate.getDate()}`);
        }
    });

    test('monthly week-of-month: respects specific time', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useWeekOfMonth: true,
                weekOfMonth: { ordinal: '1', day: 'Mon' }
            },
            time: { hour: 9, minute: 30, military: true }
        });
        const correctTime = new Date(2025, 0, 6, 9, 30); // Jan 6, 9:30 AM
        const wrongTime = new Date(2025, 0, 6, 10, 0); // Jan 6, 10:00 AM

        if (!shouldTaskRecurNow(settings, correctTime)) {
            throw new Error('Should trigger at correct time (9:30 AM)');
        }
        if (shouldTaskRecurNow(settings, wrongTime)) {
            throw new Error('Should NOT trigger at wrong time (10:00 AM)');
        }
    });

    // === END DATE (UNTIL DATE) TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🗓️ End Date (Until Date) Validation</h4>';

    test('end date: task triggers before end date', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            untilDate: '2025-01-31'
        });
        const testDate = new Date(2025, 0, 15); // Jan 15, before end date

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger before end date');
        }
    });

    test('end date: task does NOT trigger after end date', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            untilDate: '2025-01-31'
        });
        const testDate = new Date(2025, 1, 1); // Feb 1, after end date

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should NOT trigger after end date');
        }
    });

    test('end date: task triggers on the end date itself', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            untilDate: '2025-01-31'
        });
        const testDate = new Date(2025, 0, 31, 10, 0); // Jan 31, 10:00 AM (during end date)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on the end date itself');
        }
    });

    test('end date: works with weekly frequency', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: ['Mon', 'Wed', 'Fri'] },
            untilDate: '2025-01-31'
        });
        const beforeEnd = new Date(2025, 0, 27); // Jan 27 (Mon), before end
        const afterEnd = new Date(2025, 1, 3); // Feb 3 (Mon), after end

        if (!shouldTaskRecurNow(settings, beforeEnd)) {
            throw new Error('Should trigger on Monday before end date');
        }
        if (shouldTaskRecurNow(settings, afterEnd)) {
            throw new Error('Should NOT trigger on Monday after end date');
        }
    });

    test('end date: works with monthly frequency', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                days: [15]
            },
            untilDate: '2025-06-30'
        });
        const beforeEnd = new Date(2025, 5, 15); // June 15, before/on end date
        const afterEnd = new Date(2025, 6, 15); // July 15, after end date

        if (!shouldTaskRecurNow(settings, beforeEnd)) {
            throw new Error('Should trigger on 15th before end date');
        }
        if (shouldTaskRecurNow(settings, afterEnd)) {
            throw new Error('Should NOT trigger on 15th after end date');
        }
    });

    test('end date: null untilDate allows recurring indefinitely', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'daily',
            untilDate: null
        });
        const farFuture = new Date(2030, 0, 1); // Jan 1, 2030

        const result = shouldTaskRecurNow(settings, farFuture);

        if (!result) {
            throw new Error('Should trigger even in far future when no end date');
        }
    });

    // === MONTHLY LAST DAY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📆 Monthly Last Day Pattern</h4>';

    test('monthly last day: triggers on last day of 31-day month', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            }
        });
        const testDate = new Date(2025, 0, 31); // Jan 31 (31-day month)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on last day of January (31st)');
        }
    });

    test('monthly last day: triggers on last day of 30-day month', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            }
        });
        const testDate = new Date(2025, 3, 30); // April 30 (30-day month)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on last day of April (30th)');
        }
    });

    test('monthly last day: triggers on last day of February (non-leap year)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            }
        });
        const testDate = new Date(2025, 1, 28); // Feb 28, 2025 (non-leap year)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on last day of February (28th in 2025)');
        }
    });

    test('monthly last day: triggers on last day of February (leap year)', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            }
        });
        const testDate = new Date(2024, 1, 29); // Feb 29, 2024 (leap year)

        const result = shouldTaskRecurNow(settings, testDate);

        if (!result) {
            throw new Error('Should trigger on last day of February (29th in 2024)');
        }
    });

    test('monthly last day: does NOT trigger on non-last day', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            }
        });
        const testDate = new Date(2025, 0, 30); // Jan 30 (not last day)

        const result = shouldTaskRecurNow(settings, testDate);

        if (result) {
            throw new Error('Should NOT trigger on Jan 30 when last day is Jan 31');
        }
    });

    test('monthly last day: combines with specific days', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                days: [1, 15],
                lastDay: true
            }
        });

        const day1 = new Date(2025, 0, 1); // Jan 1
        const day15 = new Date(2025, 0, 15); // Jan 15
        const lastDay = new Date(2025, 0, 31); // Jan 31 (last day)
        const otherDay = new Date(2025, 0, 10); // Jan 10 (not in list)

        if (!shouldTaskRecurNow(settings, day1)) {
            throw new Error('Should trigger on 1st');
        }
        if (!shouldTaskRecurNow(settings, day15)) {
            throw new Error('Should trigger on 15th');
        }
        if (!shouldTaskRecurNow(settings, lastDay)) {
            throw new Error('Should trigger on last day (31st)');
        }
        if (shouldTaskRecurNow(settings, otherDay)) {
            throw new Error('Should NOT trigger on 10th');
        }
    });

    test('monthly last day: calculates next occurrence correctly', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            },
            time: { hour: 10, minute: 0, military: true }
        });
        const from = new Date(2025, 0, 31, 12, 0); // Jan 31, noon (after last day time)

        const next = calculateNextOccurrence(settings, from);
        const nextDate = new Date(next);

        // Should be February's last day (Feb 28 in 2025)
        if (nextDate.getMonth() !== 1) {
            throw new Error(`Expected February, got month ${nextDate.getMonth()}`);
        }
        if (nextDate.getDate() !== 28) {
            throw new Error(`Expected 28th (last day of Feb 2025), got ${nextDate.getDate()}`);
        }
    });

    test('monthly last day: respects specific time', () => {
        const settings = normalizeRecurringSettings({
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                lastDay: true
            },
            time: { hour: 9, minute: 0, military: true }
        });
        const correctTime = new Date(2025, 0, 31, 9, 0); // Jan 31, 9:00 AM
        const wrongTime = new Date(2025, 0, 31, 10, 0); // Jan 31, 10:00 AM

        if (!shouldTaskRecurNow(settings, correctTime)) {
            throw new Error('Should trigger at correct time (9:00 AM)');
        }
        if (shouldTaskRecurNow(settings, wrongTime)) {
            throw new Error('Should NOT trigger at wrong time (10:00 AM)');
        }
    });

    // === SETTINGS PERSISTENCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Settings Persistence</h4>';

    test('preserves recurringSettings when toggling OFF then ON', () => {
        const originalSettings = normalizeRecurringSettings({
            frequency: 'weekly',
            weekly: { days: [2, 4] }, // Tuesday and Thursday
            indefinitely: true,
            time: { hour: 9, minute: 30, military: true }
        });

        // Simulate toggle OFF (settings should be preserved but not active)
        const taskAfterToggleOff = {
            id: 'task-1',
            recurring: false,
            recurringSettings: originalSettings // Settings preserved
        };

        // Verify settings are still there
        if (!taskAfterToggleOff.recurringSettings) {
            throw new Error('Settings should be preserved after toggle OFF');
        }
        if (taskAfterToggleOff.recurringSettings.frequency !== 'weekly') {
            throw new Error('Frequency should be preserved');
        }
        if (!Array.isArray(taskAfterToggleOff.recurringSettings.weekly.days)) {
            throw new Error('Weekly days should be preserved');
        }
        if (taskAfterToggleOff.recurringSettings.weekly.days.length !== 2) {
            throw new Error('Should preserve 2 days');
        }

        // Simulate toggle back ON (should restore same settings)
        const taskAfterToggleOn = {
            id: 'task-1',
            recurring: true,
            recurringSettings: normalizeRecurringSettings(taskAfterToggleOff.recurringSettings)
        };

        // Verify settings match original
        if (taskAfterToggleOn.recurringSettings.frequency !== originalSettings.frequency) {
            throw new Error('Frequency should match after toggle ON');
        }
        if (taskAfterToggleOn.recurringSettings.weekly.days.length !== originalSettings.weekly.days.length) {
            throw new Error('Weekly days should match after toggle ON');
        }
        if (taskAfterToggleOn.recurringSettings.time.hour !== originalSettings.time.hour) {
            throw new Error('Time should match after toggle ON');
        }
    });

    test('normalizeRecurringSettings preserves all properties through toggle cycle', () => {
        const complexSettings = {
            frequency: 'monthly',
            monthly: {
                useSpecificDays: true,
                days: [1, 15, 28],
                lastDay: true,
                useWeekOfMonth: true,
                weekOfMonth: {
                    ordinal: '2',  // ✅ Use correct format: object with ordinal and day
                    day: 'Tue'     // Tuesday
                }
            },
            indefinitely: false,
            count: 5,
            time: { hour: 14, minute: 30, military: true }
        };

        // Toggle OFF then ON (simulate)
        const normalized1 = normalizeRecurringSettings(complexSettings);
        const normalized2 = normalizeRecurringSettings(normalized1);

        // Both normalizations should produce identical results
        if (normalized2.frequency !== complexSettings.frequency) {
            throw new Error('Frequency lost after second normalization');
        }
        if (normalized2.monthly.days.length !== complexSettings.monthly.days.length) {
            throw new Error('Monthly days lost after second normalization');
        }
        if (normalized2.monthly.lastDay !== complexSettings.monthly.lastDay) {
            throw new Error('Monthly lastDay lost after second normalization');
        }
        if (normalized2.monthly.weekOfMonth?.ordinal !== complexSettings.monthly.weekOfMonth.ordinal) {
            throw new Error('Monthly weekOfMonth ordinal lost after second normalization');
        }
        if (normalized2.monthly.weekOfMonth?.day !== complexSettings.monthly.weekOfMonth.day) {
            throw new Error('Monthly weekOfMonth day lost after second normalization');
        }
        if (normalized2.count !== complexSettings.count) {
            throw new Error('Count lost after second normalization');
        }
        if (normalized2.time.hour !== complexSettings.time.hour) {
            throw new Error('Time lost after second normalization');
        }
    });

    test('empty settings object does not break normalization', () => {
        // Simulate task with empty settings (bug scenario)
        const emptySettings = {};

        const normalized = normalizeRecurringSettings(emptySettings);

        // Should get defaults
        if (normalized.frequency !== 'daily') {
            throw new Error('Should default to daily frequency');
        }
        if (normalized.indefinitely !== true) {
            throw new Error('Should default to indefinitely');
        }
    });

    test('undefined settings gets default values', () => {
        // Simulate task with undefined settings
        const normalized = normalizeRecurringSettings(undefined);

        if (!normalized.frequency) {
            throw new Error('Should have default frequency');
        }
        if (typeof normalized.indefinitely !== 'boolean') {
            throw new Error('Should have default indefinitely value');
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
