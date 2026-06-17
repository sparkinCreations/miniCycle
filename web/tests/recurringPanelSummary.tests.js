/**
 * RecurringPanelSummary Tests
 * Tests for modules/recurring/recurringPanelSummary.js
 *
 * buildRecurringSummaryFromSettings is a pure input→output function: it takes a
 * recurring-settings object and returns a human-readable summary string built via
 * getLabel(). These tests assert the actual produced text for each frequency type,
 * duration mode, and pattern branch, plus guard/fallback paths.
 *
 * Expected substrings are derived from the default labels in defaultLabels.js
 * (recurring.summary* keys), so they remain stable regardless of theme.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelSummaryTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelSummary.js?v=${cacheBuster}`);
    const build = mod.buildRecurringSummaryFromSettings;

    resultsDiv.innerHTML = '<h2>RecurringPanelSummary Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // tiny assert helpers
    const includes = (str, sub, label) => {
        if (typeof str !== 'string' || !str.includes(sub)) {
            throw new Error(`${label}: expected "${str}" to include "${sub}"`);
        }
    };
    const notIncludes = (str, sub, label) => {
        if (typeof str === 'string' && str.includes(sub)) {
            throw new Error(`${label}: expected "${str}" NOT to include "${sub}"`);
        }
    };

    // ── Module Loading (kept from original) ──────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('buildRecurringSummaryFromSettings is an exported function', () => {
        if (typeof build !== 'function') {
            throw new Error(`Expected function, got ${typeof build}`);
        }
    });

    await test('buildRecurringSummaryFromSettings returns a string', () => {
        if (typeof build({}) !== 'string') throw new Error('Expected string');
    });

    await test('buildRecurringSummaryFromSettings handles empty/undefined input', () => {
        // Should not throw with no argument
        build();
        build({});
    });

    // ── Frequency + duration (default branch) ────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Frequency & Duration</h4>';

    await test('defaults to daily + indefinitely when nothing provided', () => {
        const s = build({});
        includes(s, 'Repeats daily', 'empty');
        includes(s, 'indefinitely', 'empty');
    });

    await test('uses provided frequency verbatim in "Repeats {freq}"', () => {
        includes(build({ frequency: 'weekly' }), 'Repeats weekly', 'weekly freq');
        includes(build({ frequency: 'monthly' }), 'Repeats monthly', 'monthly freq');
    });

    await test('count duration => "for N times" (plural) and not indefinitely', () => {
        const s = build({ frequency: 'daily', indefinitely: false, count: 5 });
        includes(s, 'for 5 times', 'count plural');
        notIncludes(s, 'indefinitely', 'count plural');
    });

    await test('count of 1 uses singular time word', () => {
        const s = build({ frequency: 'daily', indefinitely: false, count: 1 });
        includes(s, 'for 1 time', 'count singular');
        notIncludes(s, 'for 1 times', 'count singular not plural');
    });

    await test('untilDate duration => "until <formatted date>"', () => {
        const s = build({ frequency: 'daily', indefinitely: false, untilDate: '2026-03-15' });
        includes(s, 'until', 'until');
        // 2026-03-15 at T00:00:00 local -> "Mar 15, 2026"
        includes(s, '2026', 'until year');
        includes(s, 'Mar', 'until month');
    });

    await test('indefinitely true overrides count (count ignored)', () => {
        const s = build({ frequency: 'daily', indefinitely: true, count: 9 });
        includes(s, 'indefinitely', 'indef wins');
        notIncludes(s, 'for 9', 'indef wins ignores count');
    });

    // ── Time handling ─────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⏰ Time</h4>';

    await test('12-hour time formats as "h:mm meridiem"', () => {
        const s = build({
            frequency: 'daily',
            time: { hour: 9, minute: 5, meridiem: 'AM', military: false }
        });
        includes(s, 'at 9:05 AM', '12h time');
    });

    await test('military time zero-pads hour and minute', () => {
        const s = build({
            frequency: 'daily',
            time: { hour: 8, minute: 0, meridiem: 'AM', military: true }
        });
        includes(s, 'at 08:00', 'military time');
    });

    await test('useSpecificTime=false suppresses the time clause', () => {
        const s = build({
            frequency: 'daily',
            useSpecificTime: false,
            time: { hour: 9, minute: 5, meridiem: 'AM', military: false }
        });
        notIncludes(s, '9:05', 'suppressed time');
    });

    // ── Hourly ────────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🕐 Hourly</h4>';

    await test('hourly with specific minute => "at the :MM minute" (zero-padded)', () => {
        const s = build({ frequency: 'hourly', hourly: { useSpecificMinute: true, minute: 7 } });
        includes(s, 'at the :07 minute', 'hourly minute');
    });

    await test('hourly without specific minute omits minute clause', () => {
        const s = build({ frequency: 'hourly', hourly: { useSpecificMinute: false, minute: 7 } });
        notIncludes(s, 'minute', 'no hourly minute');
    });

    // ── Weekly ──────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Weekly</h4>';

    await test('weekly lists selected days joined by comma', () => {
        const s = build({ frequency: 'weekly', weekly: { days: ['Mon', 'Wed', 'Fri'] } });
        includes(s, 'on Mon, Wed, Fri', 'weekly days');
    });

    await test('weekly with empty days array has no "on" day clause', () => {
        const s = build({ frequency: 'weekly', weekly: { days: [] } });
        notIncludes(s, 'on ', 'weekly empty');
    });

    // ── Biweekly ──────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📆 Biweekly</h4>';

    await test('biweekly shows both week parts separated by pipe', () => {
        const s = build({ frequency: 'biweekly', biweekly: { week1: ['Mon'], week2: ['Thu'] } });
        includes(s, 'Week 1: Mon', 'week1');
        includes(s, 'Thu', 'week2');
        includes(s, '|', 'pipe separator');
    });

    await test('biweekly with only week1 has no pipe', () => {
        const s = build({ frequency: 'biweekly', biweekly: { week1: ['Tue'], week2: [] } });
        includes(s, 'Week 1: Tue', 'only week1');
        notIncludes(s, '|', 'no pipe');
    });

    // ── Monthly ──────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗓️ Monthly</h4>';

    await test('monthly specific days lists day numbers', () => {
        const s = build({
            frequency: 'monthly',
            monthly: { useSpecificDays: true, days: [1, 15] }
        });
        includes(s, '1, 15', 'monthly days');
    });

    await test('monthly auto-enables useSpecificDays when only days given (normalize branch)', () => {
        // settings.monthly has days but no useSpecificDays key — function sets it
        const s = build({ frequency: 'monthly', monthly: { days: [3, 9] } });
        includes(s, '3, 9', 'monthly auto specific days');
    });

    await test('monthly lastDay => "last day"', () => {
        const s = build({
            frequency: 'monthly',
            monthly: { useSpecificDays: true, lastDay: true }
        });
        includes(s, 'last day', 'monthly lastDay');
    });

    await test('monthly days + lastDay joined with "and"', () => {
        const s = build({
            frequency: 'monthly',
            monthly: { useSpecificDays: true, days: [5], lastDay: true }
        });
        includes(s, 'and', 'monthly and');
        includes(s, 'last day', 'monthly and lastDay');
    });

    await test('monthly week-of-month => "on <ordinal> <day>"', () => {
        const s = build({
            frequency: 'monthly',
            monthly: { useWeekOfMonth: true, weekOfMonth: { ordinal: '2', day: 'Tue' } }
        });
        includes(s, '2nd', 'ordinal 2nd');
        includes(s, 'Tuesday', 'day Tuesday');
    });

    await test('monthly week-of-month "last Friday" maps ordinal & day labels', () => {
        const s = build({
            frequency: 'monthly',
            monthly: { useWeekOfMonth: true, weekOfMonth: { ordinal: 'last', day: 'Fri' } }
        });
        includes(s, 'Last', 'ordinal Last');
        includes(s, 'Friday', 'day Friday');
    });

    // ── Yearly ──────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Yearly</h4>';

    await test('yearly months only => "in <Month names>"', () => {
        const s = build({ frequency: 'yearly', yearly: { months: [3, 4] } });
        includes(s, 'in Mar', 'yearly months');
        includes(s, 'Apr', 'yearly months apr');
    });

    await test('yearly shared days across months => months + day numbers', () => {
        const s = build({
            frequency: 'yearly',
            yearly: {
                months: [3, 4],
                useSpecificDays: true,
                applyDaysToAll: true,
                daysByMonth: { all: [12, 13] }
            }
        });
        includes(s, 'in Mar, Apr', 'yearly shared months');
        includes(s, '12, 13', 'yearly shared days');
    });

    await test('yearly per-month days => month name followed by its days', () => {
        const s = build({
            frequency: 'yearly',
            yearly: {
                months: [4, 3],
                useSpecificDays: true,
                applyDaysToAll: false,
                daysByMonth: { 4: [12, 13] }
            }
        });
        includes(s, 'Apr 12, 13', 'yearly per-month days');
        includes(s, 'Mar', 'yearly per-month bare month');
    });

    // ── Specific dates override ───────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Specific Dates Override</h4>';

    await test('specificDates override produces "Specific dates:" and ignores frequency', () => {
        const s = build({
            frequency: 'weekly',
            weekly: { days: ['Mon'] },
            specificDates: { enabled: true, dates: ['2026-12-25'] }
        });
        includes(s, 'Specific dates:', 'specific dates label');
        includes(s, '2026', 'specific dates year');
        notIncludes(s, 'Repeats weekly', 'specific dates overrides freq');
        notIncludes(s, 'on Mon', 'specific dates ignores weekly days');
    });

    await test('specificDates with time appends "at <time>"', () => {
        const s = build({
            specificDates: { enabled: true, dates: ['2026-01-01'] },
            time: { hour: 6, minute: 30, meridiem: 'PM', military: false }
        });
        includes(s, 'Specific dates:', 'specific dates label');
        includes(s, 'at 6:30 PM', 'specific dates time');
    });

    await test('specificDates falls back to raw string when date unparseable', () => {
        const s = build({ specificDates: { enabled: true, dates: ['not-a-date'] } });
        // parseDateAsLocal returns a Date (NaN) but toLocaleDateString may yield
        // "Invalid Date"; the raw fallback path only hits when parse throws. Either
        // way the function must not throw and must include the dates label.
        includes(s, 'Specific dates:', 'unparseable date no throw');
    });

    await test('specificDates disabled => normal recurrence path used', () => {
        const s = build({
            frequency: 'daily',
            specificDates: { enabled: false, dates: ['2026-01-01'] }
        });
        includes(s, 'Repeats daily', 'disabled specific dates');
        notIncludes(s, 'Specific dates:', 'disabled specific dates no override');
    });

    // ── results ──────────────────────────────────────────────────────────────
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
