/**
 * RecurringSettings Tests
 * Tests for modules/recurring/recurringSettings.js
 *
 * normalizeRecurringSettings is a pure (modulo current-date defaults) function
 * that fills a partial recurring-settings object with a complete, defaulted shape.
 * It also memoizes the time-independent shape and returns deep clones so callers
 * cannot corrupt the cache. These tests cover: default values, type coercion,
 * pass-through of provided values, the current-date "sensible default" branches
 * per frequency, and cache-isolation (clone) behavior.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringSettingsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringSettings.js?v=${cacheBuster}`);
    const normalize = mod.normalizeRecurringSettings;

    resultsDiv.innerHTML = '<h2>RecurringSettings Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const eq = (a, b, label) => { if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
    const isArr = (v, label) => { if (!Array.isArray(v)) throw new Error(`${label}: expected array, got ${typeof v}`); };

    // ── Module Loading (kept) ────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('normalizeRecurringSettings is an exported function', () => {
        if (typeof normalize !== 'function') throw new Error(`Expected function, got ${typeof normalize}`);
    });

    await test('returns an object with frequency property', () => {
        const r = normalize({});
        if (typeof r !== 'object' || r === null) throw new Error('not an object');
        if (!('frequency' in r)) throw new Error('missing frequency');
    });

    // ── Defaults & top-level fields ───────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Defaults</h4>';

    await test('empty input defaults frequency to "daily"', () => {
        eq(normalize({}).frequency, 'daily', 'default freq');
    });

    // Security (notifications-review): frequency reaches an unescaped HTML sink
    // and imports normalize through here — an off-list value must be coerced to
    // 'daily', never passed through.
    await test('rejects an XSS payload frequency, coercing to "daily"', () => {
        eq(normalize({ frequency: '<img src=x onerror=alert(1)>' }).frequency, 'daily', 'XSS freq coerced');
        eq(normalize({ frequency: 'totally-made-up' }).frequency, 'daily', 'unknown freq coerced');
    });

    await test('all six canonical frequencies pass through unchanged', () => {
        for (const f of ['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly']) {
            eq(normalize({ frequency: f }).frequency, f, `${f} preserved`);
        }
    });

    // Security (recurring-panel review): same import door as frequency — the
    // panel's selects only emit valid values, but imports are a second producer.
    // An off-list ordinal (e.g. '5') makes calculateNthWeekdayOfMonth return
    // null for EVERY month, degenerating the recurrence to "1st of next month".
    await test('rejects off-list weekOfMonth ordinal and day, coercing to defaults', () => {
        const wom = (o, d) => normalize({
            frequency: 'monthly',
            monthly: { useWeekOfMonth: true, weekOfMonth: { ordinal: o, day: d } }
        }).monthly.weekOfMonth;

        eq(wom('5', 'Mon').ordinal, '1', "ordinal '5' coerced");
        eq(wom('<img src=x>', 'Mon').ordinal, '1', 'hostile ordinal coerced');
        eq(wom('2', 'Funday').day, 'Mon', 'unknown day coerced');
        eq(wom('2', 'Mon').ordinal, '2', 'valid ordinal preserved');
        eq(wom('last', 'Sat').ordinal, 'last', "'last' preserved");
        eq(wom(3, 'Tue').ordinal, '3', 'numeric ordinal stringified and preserved');
    });

    await test('indefinitely defaults to true', () => {
        eq(normalize({}).indefinitely, true, 'default indefinitely');
    });

    await test('indefinitely:false is preserved (=== false check)', () => {
        eq(normalize({ indefinitely: false }).indefinitely, false, 'explicit false');
    });

    await test('count defaults to null and passes through when set', () => {
        eq(normalize({}).count, null, 'default count null');
        eq(normalize({ count: 3 }).count, 3, 'count passthrough');
    });

    await test('untilDate defaults null, useSpecificTime defaults false', () => {
        const r = normalize({});
        eq(r.untilDate, null, 'untilDate null');
        eq(r.useSpecificTime, false, 'useSpecificTime false');
    });

    await test('all frequency sub-objects exist with array fields', () => {
        const r = normalize({});
        isArr(r.specificDates.dates, 'specificDates.dates');
        isArr(r.weekly.days, 'weekly.days');
        isArr(r.biweekly.week1, 'biweekly.week1');
        isArr(r.biweekly.week2, 'biweekly.week2');
        isArr(r.monthly.days, 'monthly.days');
        isArr(r.yearly.months, 'yearly.months');
    });

    // ── Type coercion / sanitization ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Coercion</h4>';

    await test('non-array weekly.days is replaced with empty array', () => {
        const r = normalize({ frequency: 'monthly', weekly: { days: 'Mon' } });
        // (use monthly so the weekly default-fill branch doesn't run)
        isArr(r.weekly.days, 'weekly.days coerced');
        eq(r.weekly.days.length, 0, 'weekly.days emptied');
    });

    await test('non-array specificDates.dates replaced with empty array', () => {
        const r = normalize({ specificDates: { enabled: true, dates: 'oops' } });
        isArr(r.specificDates.dates, 'dates coerced');
        eq(r.specificDates.dates.length, 0, 'dates emptied');
    });

    await test('hourly.minute defaults to 0 when absent', () => {
        const r = normalize({ frequency: 'monthly', hourly: {} });
        eq(r.hourly.minute, 0, 'hourly minute default');
    });

    // ── Provided-value pass-through ───────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">➡️ Pass-through</h4>';

    await test('weekly days provided are preserved (no default-fill)', () => {
        const r = normalize({ frequency: 'weekly', weekly: { days: ['Mon', 'Tue'] } });
        eq(r.weekly.days.length, 2, 'weekly preserved length');
        eq(r.weekly.days[0], 'Mon', 'weekly preserved[0]');
    });

    await test('monthly weekOfMonth normalizes ordinal/day with defaults', () => {
        const r = normalize({ frequency: 'monthly', monthly: { useWeekOfMonth: true, weekOfMonth: {} } });
        eq(r.monthly.weekOfMonth.ordinal, '1', 'wom ordinal default');
        eq(r.monthly.weekOfMonth.day, 'Mon', 'wom day default');
    });

    await test('monthly weekOfMonth is null when not using week-of-month', () => {
        const r = normalize({ frequency: 'monthly', monthly: { useSpecificDays: true, days: [5] } });
        eq(r.monthly.weekOfMonth, null, 'wom null');
    });

    await test('monthly.useSpecificDays inferred true when days provided', () => {
        const r = normalize({ frequency: 'monthly', monthly: { days: [5] } });
        eq(r.monthly.useSpecificDays, true, 'inferred useSpecificDays');
    });

    await test('yearly.applyDaysToAll defaults true (=== false check)', () => {
        eq(normalize({ frequency: 'monthly', yearly: {} }).yearly.applyDaysToAll, true, 'applyDaysToAll default');
        eq(normalize({ frequency: 'monthly', yearly: { applyDaysToAll: false } }).yearly.applyDaysToAll, false, 'applyDaysToAll explicit false');
    });

    // ── Current-date sensible defaults per frequency ──────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📍 Sensible Defaults</h4>';

    await test('weekly with no days defaults to exactly one day (current weekday)', () => {
        const r = normalize({ frequency: 'weekly' });
        eq(r.weekly.days.length, 1, 'weekly default one day');
        // should be a valid 3-letter weekday abbreviation
        if (!/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/.test(r.weekly.days[0])) {
            throw new Error('not a weekday abbr: ' + r.weekly.days[0]);
        }
    });

    await test('biweekly with no days fills week1 (one day), leaves week2 empty', () => {
        const r = normalize({ frequency: 'biweekly' });
        eq(r.biweekly.week1.length, 1, 'biweekly week1 one day');
        eq(r.biweekly.week2.length, 0, 'biweekly week2 empty');
    });

    await test('biweekly referenceDate is backfilled to an ISO timestamp', () => {
        const r = normalize({ frequency: 'biweekly' });
        if (typeof r.biweekly.referenceDate !== 'string') throw new Error('no referenceDate');
        if (Number.isNaN(Date.parse(r.biweekly.referenceDate))) throw new Error('referenceDate not parseable');
    });

    await test('monthly with no pattern defaults to a single day-of-month number', () => {
        const r = normalize({ frequency: 'monthly' });
        eq(r.monthly.useSpecificDays, true, 'monthly default specific');
        eq(r.monthly.days.length, 1, 'monthly default one day');
        if (typeof r.monthly.days[0] !== 'number') throw new Error('day-of-month not a number');
    });

    await test('monthly week-of-month pattern is NOT overwritten by day default', () => {
        const r = normalize({ frequency: 'monthly', monthly: { useWeekOfMonth: true, weekOfMonth: { ordinal: '2', day: 'Wed' } } });
        eq(r.monthly.days.length, 0, 'wom keeps days empty');
        eq(r.monthly.weekOfMonth.ordinal, '2', 'wom ordinal preserved');
    });

    await test('hourly with no specific minute anchors to current minute', () => {
        const r = normalize({ frequency: 'hourly' });
        eq(r.hourly.useSpecificMinute, true, 'hourly default useSpecificMinute');
        if (typeof r.hourly.minute !== 'number' || r.hourly.minute < 0 || r.hourly.minute > 59) {
            throw new Error('bad default minute: ' + r.hourly.minute);
        }
    });

    await test('yearly with no months defaults to current month + day, applyDaysToAll', () => {
        const r = normalize({ frequency: 'yearly' });
        eq(r.yearly.months.length, 1, 'yearly default one month');
        eq(r.yearly.useSpecificDays, true, 'yearly default specific days');
        eq(r.yearly.applyDaysToAll, true, 'yearly default applyDaysToAll');
        isArr(r.yearly.daysByMonth.all, 'yearly daysByMonth.all');
        eq(r.yearly.daysByMonth.all.length, 1, 'yearly default one day');
    });

    // ── Cache isolation (clone) behavior ──────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔒 Cache Isolation</h4>';

    await test('two calls with identical input return distinct object instances', () => {
        const a = normalize({ frequency: 'monthly', monthly: { days: [5] } });
        const b = normalize({ frequency: 'monthly', monthly: { days: [5] } });
        if (a === b) throw new Error('returned same reference (cache leak)');
        if (a.monthly === b.monthly) throw new Error('shared nested reference');
    });

    await test('mutating a returned result does not corrupt the cache', () => {
        const input = { frequency: 'monthly', monthly: { days: [1, 2] } };
        const first = normalize(input);
        first.monthly.days.push(999);
        first.frequency = 'CORRUPTED';
        const second = normalize(input);
        eq(second.frequency, 'monthly', 'cache freq intact');
        eq(second.monthly.days.length, 2, 'cache days intact');
        if (second.monthly.days.includes(999)) throw new Error('cache was corrupted by caller mutation');
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
