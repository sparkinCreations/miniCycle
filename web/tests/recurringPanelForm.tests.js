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

    // ------------------------------------------------------------------
    // DOM fixture helper — mounts an isolated sandbox and returns deps
    // (getElementById / querySelector / querySelectorAll) scoped to it.
    // ------------------------------------------------------------------
    let sandbox;
    function mount(html) {
        sandbox = document.createElement('div');
        sandbox.innerHTML = html;
        document.body.appendChild(sandbox);
        return {
            getElementById: (id) => sandbox.querySelector(`#${CSS.escape(id)}`),
            querySelector: (sel) => sandbox.querySelector(sel),
            querySelectorAll: (sel) => sandbox.querySelectorAll(sel)
        };
    }
    function unmount() {
        if (sandbox && sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
        sandbox = null;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('getTomorrow is an exported function', () => {
        if (typeof mod.getTomorrow !== 'function') throw new Error(`got ${typeof mod.getTomorrow}`);
    });

    await test('setFormActions is an exported function (DI setter)', () => {
        if (typeof mod.setFormActions !== 'function') throw new Error(`got ${typeof mod.setFormActions}`);
    });

    await test('buildRecurringSettingsFromPanel is an exported function', () => {
        if (typeof mod.buildRecurringSettingsFromPanel !== 'function') throw new Error(`got ${typeof mod.buildRecurringSettingsFromPanel}`);
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📅 getTomorrow</h4>';

    await test('getTomorrow returns a Date one day in the future', () => {
        const result = mod.getTomorrow();
        if (!(result instanceof Date)) throw new Error(`Expected Date, got ${typeof result}`);
        const today = new Date();
        if (result.getTime() <= today.getTime()) throw new Error('not in the future');
    });

    await test('getTomorrow day matches today + 1 (normalized)', () => {
        const t = mod.getTomorrow();
        const expected = new Date();
        expected.setDate(expected.getDate() + 1);
        if (t.getFullYear() !== expected.getFullYear() ||
            t.getMonth() !== expected.getMonth() ||
            t.getDate() !== expected.getDate()) {
            throw new Error(`got ${t.toDateString()} expected ${expected.toDateString()}`);
        }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Selection readers</h4>';

    await test('getSelectedMonthlyDays reads .selected boxes as numbers', () => {
        const deps = mount(
            '<div class="monthly-days">' +
            '<div class="monthly-day-box selected" data-day="3"></div>' +
            '<div class="monthly-day-box" data-day="4"></div>' +
            '<div class="monthly-day-box selected" data-day="15"></div>' +
            '</div>'
        );
        try {
            const days = mod.getSelectedMonthlyDays(deps);
            if (JSON.stringify(days) !== JSON.stringify([3, 15])) throw new Error(`got ${JSON.stringify(days)}`);
            if (typeof days[0] !== 'number') throw new Error('values not numeric');
        } finally { unmount(); }
    });

    await test('getSelectedMonthlyDays returns [] when none selected', () => {
        const deps = mount('<div class="monthly-days"><div class="monthly-day-box" data-day="1"></div></div>');
        try {
            const days = mod.getSelectedMonthlyDays(deps);
            if (days.length !== 0) throw new Error(`got ${JSON.stringify(days)}`);
        } finally { unmount(); }
    });

    await test('getSelectedYearlyMonths reads .selected month boxes as numbers', () => {
        const deps = mount(
            '<div class="yearly-months">' +
            '<div class="yearly-month-box selected" data-month="1"></div>' +
            '<div class="yearly-month-box" data-month="2"></div>' +
            '<div class="yearly-month-box selected" data-month="12"></div>' +
            '</div>'
        );
        try {
            const months = mod.getSelectedYearlyMonths(deps);
            if (JSON.stringify(months) !== JSON.stringify([1, 12])) throw new Error(`got ${JSON.stringify(months)}`);
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ updateRecurCountVisibility</h4>';

    await test('Count container shown when finite + not specific dates', () => {
        const deps = mount(
            '<input type="checkbox" id="recur-indefinitely">' +
            '<input type="checkbox" id="recur-specific-dates">' +
            '<div id="recur-count-container" class="hidden"></div>'
        );
        try {
            mod.updateRecurCountVisibility(deps);
            const c = sandbox.querySelector('#recur-count-container');
            if (c.classList.contains('hidden')) throw new Error('container should be visible');
        } finally { unmount(); }
    });

    await test('Count container hidden when indefinitely checked', () => {
        const deps = mount(
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="recur-specific-dates">' +
            '<div id="recur-count-container"></div>'
        );
        try {
            mod.updateRecurCountVisibility(deps);
            if (!sandbox.querySelector('#recur-count-container').classList.contains('hidden')) {
                throw new Error('container should be hidden when indefinite');
            }
        } finally { unmount(); }
    });

    await test('Count container hidden when using specific dates', () => {
        const deps = mount(
            '<input type="checkbox" id="recur-indefinitely">' +
            '<input type="checkbox" id="recur-specific-dates" checked>' +
            '<div id="recur-count-container"></div>'
        );
        try {
            mod.updateRecurCountVisibility(deps);
            if (!sandbox.querySelector('#recur-count-container').classList.contains('hidden')) {
                throw new Error('container should be hidden when specific dates');
            }
        } finally { unmount(); }
    });

    await test('updateRecurCountVisibility no-ops when container missing', () => {
        const deps = mount('<input type="checkbox" id="recur-indefinitely">');
        try {
            mod.updateRecurCountVisibility(deps); // should not throw
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🕐 parseTimeInput / toTimeInputValue</h4>';

    await test('parseTimeInput: "13:05" → 1:05 PM (12-hour storage shape)', () => {
        const t = mod.parseTimeInput('13:05');
        if (t.hour !== 1 || t.minute !== 5 || t.meridiem !== 'PM' || t.military !== false) {
            throw new Error(JSON.stringify(t));
        }
    });

    await test('parseTimeInput: "00:00" → 12:00 AM (midnight edge)', () => {
        const t = mod.parseTimeInput('00:00');
        if (t.hour !== 12 || t.minute !== 0 || t.meridiem !== 'AM') throw new Error(JSON.stringify(t));
    });

    await test('parseTimeInput: "12:30" → 12:30 PM (noon edge)', () => {
        const t = mod.parseTimeInput('12:30');
        if (t.hour !== 12 || t.meridiem !== 'PM') throw new Error(JSON.stringify(t));
    });

    await test('parseTimeInput: empty/invalid defaults to 12:00 AM', () => {
        const t = mod.parseTimeInput('');
        if (t.hour !== 12 || t.minute !== 0 || t.meridiem !== 'AM') throw new Error(JSON.stringify(t));
    });

    await test('toTimeInputValue: 9:30 PM → "21:30"', () => {
        const v = mod.toTimeInputValue({ hour: 9, minute: 30, meridiem: 'PM', military: false });
        if (v !== '21:30') throw new Error(v);
    });

    await test('toTimeInputValue: 12 AM → "00:00", 12 PM → "12:00"', () => {
        if (mod.toTimeInputValue({ hour: 12, minute: 0, meridiem: 'AM' }) !== '00:00') throw new Error('12 AM');
        if (mod.toTimeInputValue({ hour: 12, minute: 0, meridiem: 'PM' }) !== '12:00') throw new Error('12 PM');
    });

    await test('toTimeInputValue: legacy military-stored time round-trips', () => {
        // A saved template stored as 24-hour (military: true) must still format correctly.
        if (mod.toTimeInputValue({ hour: 18, minute: 5, military: true }) !== '18:05') throw new Error('military');
    });

    await test('parseTimeInput ∘ toTimeInputValue round-trips a 24-hour value', () => {
        const v = mod.toTimeInputValue(mod.parseTimeInput('07:45'));
        if (v !== '07:45') throw new Error(v);
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ buildRecurringSettingsFromPanel</h4>';

    // Ensure no normalize action interferes with raw-shape assertions.
    mod.setFormActions({ updateRecurringSummary: null, normalizeRecurringSettings: null });

    await test('Default daily indefinite build returns expected shape', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (s.frequency !== 'daily') throw new Error(`freq=${s.frequency}`);
            if (s.indefinitely !== true) throw new Error(`indefinitely=${s.indefinitely}`);
            if (s.count !== null) throw new Error(`count=${s.count}`);
            if (s.untilDate !== null) throw new Error(`until=${s.untilDate}`);
        } finally { unmount(); }
    });

    await test('Finite count mode reads count input', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely">' +
            '<input type="radio" id="recur-count-radio" checked>' +
            '<input type="radio" id="recur-until-radio">' +
            '<input id="recur-count-input" value="5">'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (s.indefinitely !== false) throw new Error(`indefinitely=${s.indefinitely}`);
            if (s.count !== 5) throw new Error(`count=${s.count}`);
        } finally { unmount(); }
    });

    await test('Until-date mode reads until-date input', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely">' +
            '<input type="radio" id="recur-count-radio">' +
            '<input type="radio" id="recur-until-radio" checked>' +
            '<input id="recur-until-date" value="2030-01-15">'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (s.untilDate !== '2030-01-15') throw new Error(`until=${s.untilDate}`);
            if (s.count !== null) throw new Error(`count should stay null, got ${s.count}`);
        } finally { unmount(); }
    });

    await test('Weekly frequency captures selected weekly days', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="weekly" selected>weekly</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="weekly-specific-days" checked>' +
            '<input type="checkbox" id="weekly-specific-time">' +
            '<div class="weekly-days">' +
            '<div class="weekly-day-box selected" data-day="Mon"></div>' +
            '<div class="weekly-day-box" data-day="Tue"></div>' +
            '<div class="weekly-day-box selected" data-day="Fri"></div>' +
            '</div>'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (s.weekly.useSpecificDays !== true) throw new Error('useSpecificDays not true');
            if (JSON.stringify(s.weekly.days) !== JSON.stringify(['Mon', 'Fri'])) {
                throw new Error(`days=${JSON.stringify(s.weekly.days)}`);
            }
        } finally { unmount(); }
    });

    await test('Monthly frequency captures specific days + lastDay', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="monthly" selected>monthly</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="monthly-specific-days" checked>' +
            '<input type="checkbox" id="monthly-week-of-month">' +
            '<input type="checkbox" id="monthly-last-day" checked>' +
            '<input type="checkbox" id="monthly-specific-time">' +
            '<div class="monthly-days">' +
            '<div class="monthly-day-box selected" data-day="1"></div>' +
            '<div class="monthly-day-box selected" data-day="14"></div>' +
            '</div>'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (JSON.stringify(s.monthly.days) !== JSON.stringify([1, 14])) throw new Error(`days=${JSON.stringify(s.monthly.days)}`);
            if (s.monthly.lastDay !== true) throw new Error('lastDay not captured');
            if (s.monthly.useWeekOfMonth !== false) throw new Error('weekOfMonth should be false');
        } finally { unmount(); }
    });

    await test('Hourly frequency captures specific minute', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="hourly" selected>hourly</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="hourly-specific-time" checked>' +
            '<input id="hourly-minute" value="42">'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (s.hourly.useSpecificMinute !== true) throw new Error('useSpecificMinute not true');
            if (s.hourly.minute !== 42) throw new Error(`minute=${s.hourly.minute}`);
        } finally { unmount(); }
    });

    await test('Specific-dates mode collects date inputs + ignores blanks', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="recur-specific-dates" checked>' +
            '<input type="checkbox" id="specific-date-specific-time">' +
            '<div id="specific-date-list">' +
            '<input type="date" value="2030-02-01">' +
            '<input type="date" value="">' +
            '<input type="date" value="2030-03-10">' +
            '</div>'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (s.specificDates.enabled !== true) throw new Error('specificDates not enabled');
            if (JSON.stringify(s.specificDates.dates) !== JSON.stringify(['2030-02-01', '2030-03-10'])) {
                throw new Error(`dates=${JSON.stringify(s.specificDates.dates)}`);
            }
        } finally { unmount(); }
    });

    await test('Yearly apply-to-all collapses daysByMonth to {all}', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="yearly" selected>yearly</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="yearly-specific-months" checked>' +
            '<input type="checkbox" id="yearly-specific-days" checked>' +
            '<input type="checkbox" id="yearly-apply-days-to-all" checked>' +
            '<input type="checkbox" id="yearly-specific-time">' +
            '<div class="yearly-months">' +
            '<div class="yearly-month-box selected" data-month="6"></div>' +
            '</div>'
        );
        try {
            const state = { selectedYearlyDays: { 6: [1, 2], all: [9, 10] } };
            const s = mod.buildRecurringSettingsFromPanel(deps, state);
            if (s.yearly.applyDaysToAll !== true) throw new Error('applyDaysToAll not true');
            if (JSON.stringify(s.yearly.daysByMonth) !== JSON.stringify({ all: [9, 10] })) {
                throw new Error(`daysByMonth=${JSON.stringify(s.yearly.daysByMonth)}`);
            }
            if (JSON.stringify(s.yearly.months) !== JSON.stringify([6])) throw new Error(`months=${JSON.stringify(s.yearly.months)}`);
        } finally { unmount(); }
    });

    await test('normalizeRecurringSettings action is applied when wired', () => {
        let received = null;
        mod.setFormActions({
            normalizeRecurringSettings: (s) => { received = s; return { ...s, normalized: true }; }
        });
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>'
        );
        try {
            const s = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (!received) throw new Error('normalize action never invoked');
            if (s.normalized !== true) throw new Error('normalized result not returned');
        } finally {
            unmount();
            mod.setFormActions({ normalizeRecurringSettings: null }); // reset
        }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">✍️ populate + clear round-trip</h4>';

    await test('populateRecurringFormWithSettings writes frequency + count', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily">daily</option><option value="weekly">weekly</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="radio" id="recur-count-radio">' +
            '<input id="recur-count-input">'
        );
        try {
            mod.populateRecurringFormWithSettings(deps, {
                frequency: 'weekly',
                indefinitely: false,
                count: 7
            });
            if (sandbox.querySelector('#recur-frequency').value !== 'weekly') throw new Error('frequency not set');
            if (sandbox.querySelector('#recur-indefinitely').checked) throw new Error('indefinite should be unchecked');
            if (sandbox.querySelector('#recur-count-radio').checked !== true) throw new Error('count radio not checked');
            if (sandbox.querySelector('#recur-count-input').value !== '7') throw new Error('count not written');
        } finally { unmount(); }
    });

    await test('populate writes specific time to native time input for daily', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>' +
            '<input type="checkbox" id="daily-specific-time">' +
            '<input type="time" id="daily-time">'
        );
        try {
            mod.populateRecurringFormWithSettings(deps, {
                frequency: 'daily',
                indefinitely: true,
                useSpecificTime: true,
                time: { hour: 9, minute: 30, meridiem: 'PM', military: false }
            });
            if (sandbox.querySelector('#daily-specific-time').checked !== true) throw new Error('time checkbox not checked');
            // 9:30 PM → "21:30" (native <input type="time"> is always 24-hour)
            if (sandbox.querySelector('#daily-time').value !== '21:30') {
                throw new Error(`time=${sandbox.querySelector('#daily-time').value}`);
            }
        } finally { unmount(); }
    });

    await test('populate calls updateRecurringSummary action when wired', () => {
        let called = false;
        mod.setFormActions({ updateRecurringSummary: () => { called = true; } });
        const deps = mount(
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely" checked>'
        );
        try {
            mod.populateRecurringFormWithSettings(deps, { frequency: 'daily', indefinitely: true });
            if (!called) throw new Error('updateRecurringSummary not called');
        } finally {
            unmount();
            mod.setFormActions({ updateRecurringSummary: null });
        }
    });

    await test('clearRecurringForm resets frequency=daily, indefinite=true, count cleared', () => {
        const deps = mount(
            '<select id="recur-frequency"><option value="daily">daily</option><option value="weekly" selected>weekly</option></select>' +
            '<input type="checkbox" id="recur-indefinitely">' +
            '<input id="recur-count-input" value="9">'
        );
        try {
            mod.clearRecurringForm(deps);
            if (sandbox.querySelector('#recur-frequency').value !== 'daily') throw new Error('frequency not reset');
            if (sandbox.querySelector('#recur-indefinitely').checked !== true) throw new Error('indefinite not reset');
            if (sandbox.querySelector('#recur-count-input').value !== '') throw new Error('count not cleared');
        } finally { unmount(); }
    });

    await test('build → populate → build round-trip preserves count', () => {
        mod.setFormActions({ updateRecurringSummary: null, normalizeRecurringSettings: null });
        const html =
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<input type="checkbox" id="recur-indefinitely">' +
            '<input type="radio" id="recur-count-radio" checked>' +
            '<input type="radio" id="recur-until-radio">' +
            '<input id="recur-count-input" value="3">';
        const deps = mount(html);
        try {
            const built = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            // Wipe and repopulate from built settings
            sandbox.querySelector('#recur-count-input').value = '';
            sandbox.querySelector('#recur-count-radio').checked = false;
            mod.populateRecurringFormWithSettings(deps, built);
            const rebuilt = mod.buildRecurringSettingsFromPanel(deps, { selectedYearlyDays: {} });
            if (rebuilt.count !== 3) throw new Error(`round-trip count=${rebuilt.count}`);
            if (rebuilt.indefinitely !== false) throw new Error('round-trip indefinitely lost');
        } finally { unmount(); }
    });

    await test('buildRecurringSettingsFromPanel returns safe fallback on internal error', () => {
        // Pass deps whose getElementById throws to trip the try/catch.
        const throwingDeps = {
            getElementById: () => { throw new Error('boom'); },
            querySelectorAll: () => []
        };
        const s = mod.buildRecurringSettingsFromPanel(throwingDeps, { selectedYearlyDays: {} });
        if (s.frequency !== 'daily' || s.indefinitely !== true) {
            throw new Error(`unexpected fallback ${JSON.stringify(s)}`);
        }
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
