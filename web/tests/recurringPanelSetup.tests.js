/**
 * RecurringPanelSetup Tests
 * Tests for modules/recurring/recurringPanelSetup.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelSetupTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelSetup.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringPanelSetup Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ------------------------------------------------------------------
    // Sandbox + deps factory. These setup fns wire real listeners via
    // deps.safeAddEventListener, so we provide a real one bound to the
    // sandboxed DOM and exercise behavior by dispatching events.
    // ------------------------------------------------------------------
    let sandbox;
    function mount(html) {
        sandbox = document.createElement('div');
        sandbox.innerHTML = html;
        document.body.appendChild(sandbox);
        return {
            getElementById: (id) => sandbox.querySelector(`#${CSS.escape(id)}`),
            querySelector: (sel) => sandbox.querySelector(sel),
            querySelectorAll: (sel) => sandbox.querySelectorAll(sel),
            getModal: () => null,
            safeAddEventListener: (el, ev, fn, opts) => {
                if (el && el.addEventListener) el.addEventListener(ev, fn, opts);
            }
        };
    }
    function unmount() {
        if (sandbox && sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
        sandbox = null;
    }
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => { if (!mod) throw new Error('Module is falsy'); });
    await test('setupFrequencySelector is an exported function', () => {
        if (typeof mod.setupFrequencySelector !== 'function') throw new Error(`got ${typeof mod.setupFrequencySelector}`);
    });
    await test('setupToggleVisibility is an exported function', () => {
        if (typeof mod.setupToggleVisibility !== 'function') throw new Error(`got ${typeof mod.setupToggleVisibility}`);
    });
    await test('setupAdvancedToggle is an exported function', () => {
        if (typeof mod.setupAdvancedToggle !== 'function') throw new Error(`got ${typeof mod.setupAdvancedToggle}`);
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 setupFrequencySelector</h4>';

    function frequencyFixture() {
        return mount(
            '<button id="toggle-advanced-settings" data-advanced-visible="true"></button>' +
            '<select id="recur-frequency">' +
            '<option value="daily">daily</option><option value="weekly">weekly</option>' +
            '</select>' +
            '<div id="hourly-options"></div><div id="daily-options"></div>' +
            '<div id="weekly-options"></div><div id="biweekly-options"></div>' +
            '<div id="monthly-options"></div><div id="yearly-options"></div>' +
            '<div id="hourly-time-section"></div><div id="daily-time-section"></div>' +
            '<div id="weekly-time-section"></div><div id="biweekly-time-section"></div>' +
            '<div id="monthly-time-section"></div><div id="yearly-time-section"></div>'
        );
    }

    await test('Changing frequency reveals matching options panel when advanced ON', () => {
        const deps = frequencyFixture();
        try {
            mod.setupFrequencySelector(deps, null);
            const sel = sandbox.querySelector('#recur-frequency');
            sel.value = 'weekly';
            fire(sel, 'change');
            if (!sandbox.querySelector('#weekly-options') || sandbox.querySelector('#weekly-options').classList.contains('hidden')) {
                throw new Error('weekly-options should be visible');
            }
            if (!sandbox.querySelector('#daily-options').classList.contains('hidden')) {
                throw new Error('daily-options should be hidden');
            }
        } finally { unmount(); }
    });

    await test('Frequency options stay hidden when advanced OFF', () => {
        const deps = frequencyFixture();
        try {
            sandbox.querySelector('#toggle-advanced-settings').dataset.advancedVisible = 'false';
            mod.setupFrequencySelector(deps, null);
            const sel = sandbox.querySelector('#recur-frequency');
            sel.value = 'weekly';
            fire(sel, 'change');
            if (!sandbox.querySelector('#weekly-options').classList.contains('hidden')) {
                throw new Error('weekly-options should remain hidden when advanced off');
            }
        } finally { unmount(); }
    });

    await test('Frequency change always reveals matching time section', () => {
        const deps = frequencyFixture();
        try {
            mod.setupFrequencySelector(deps, null);
            const sel = sandbox.querySelector('#recur-frequency');
            sel.value = 'weekly';
            fire(sel, 'change');
            if (sandbox.querySelector('#weekly-time-section').classList.contains('hidden')) {
                throw new Error('weekly-time-section should be visible');
            }
            if (!sandbox.querySelector('#daily-time-section').classList.contains('hidden')) {
                throw new Error('daily-time-section should be hidden');
            }
        } finally { unmount(); }
    });

    await test('Frequency change invokes onUpdate callback', () => {
        const deps = frequencyFixture();
        let calls = 0;
        try {
            mod.setupFrequencySelector(deps, () => calls++);
            fire(sandbox.querySelector('#recur-frequency'), 'change');
            if (calls !== 1) throw new Error(`onUpdate called ${calls} times`);
        } finally { unmount(); }
    });

    await test('setupFrequencySelector no-ops when select missing', () => {
        const deps = mount('<div></div>');
        try { mod.setupFrequencySelector(deps, null); } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ setupToggleVisibility</h4>';

    await test('Hourly specific-time checkbox toggles minute container hidden class', () => {
        const deps = mount(
            '<input type="checkbox" id="hourly-specific-time">' +
            '<div id="hourly-minute-container" class="hidden"></div>'
        );
        try {
            mod.setupToggleVisibility(deps);
            const cb = sandbox.querySelector('#hourly-specific-time');
            const container = sandbox.querySelector('#hourly-minute-container');
            cb.checked = true;
            fire(cb, 'change');
            if (container.classList.contains('hidden')) throw new Error('container should show when checked');
            cb.checked = false;
            fire(cb, 'change');
            if (!container.classList.contains('hidden')) throw new Error('container should hide when unchecked');
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">☑️ setupToggleCheckAll</h4>';

    function checkAllFixture(allChecked) {
        return mount(
            '<button id="toggle-check-all"></button>' +
            '<div class="recurring-task-item">' +
            `<input type="checkbox" class="recurring-check" ${allChecked ? 'checked' : ''}></div>` +
            '<div class="recurring-task-item">' +
            `<input type="checkbox" class="recurring-check" ${allChecked ? 'checked' : ''}></div>`
        );
    }

    await test('Check-all checks every visible checkbox when some unchecked', () => {
        const deps = checkAllFixture(false);
        try {
            mod.setupToggleCheckAll(deps, null);
            fire(sandbox.querySelector('#toggle-check-all'), 'click');
            const boxes = sandbox.querySelectorAll('.recurring-check');
            if (!Array.from(boxes).every(b => b.checked)) throw new Error('not all checked');
            // items should gain the .checked class
            if (!Array.from(sandbox.querySelectorAll('.recurring-task-item')).every(i => i.classList.contains('checked'))) {
                throw new Error('items missing checked class');
            }
        } finally { unmount(); }
    });

    await test('Check-all unchecks everything when all already checked', () => {
        const deps = checkAllFixture(true);
        try {
            mod.setupToggleCheckAll(deps, null);
            fire(sandbox.querySelector('#toggle-check-all'), 'click');
            const boxes = sandbox.querySelectorAll('.recurring-check');
            if (Array.from(boxes).some(b => b.checked)) throw new Error('expected all unchecked');
        } finally { unmount(); }
    });

    await test('Check-all invokes onUpdate callback', () => {
        const deps = checkAllFixture(false);
        let calls = 0;
        try {
            mod.setupToggleCheckAll(deps, () => calls++);
            fire(sandbox.querySelector('#toggle-check-all'), 'click');
            if (calls !== 1) throw new Error(`onUpdate=${calls}`);
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ setupAdvancedToggle</h4>';

    function advancedFixture() {
        return mount(
            '<button id="toggle-advanced-settings"></button>' +
            '<select id="recur-frequency"><option value="daily" selected>daily</option></select>' +
            '<div id="recur-frequency-container" class="hidden"></div>' +
            '<div class="frequency-options" id="daily-options"></div>' +
            '<div class="frequency-options" id="weekly-options"></div>' +
            '<label><input type="checkbox" id="recur-indefinitely"></label>' +
            '<div id="set-default-recurring-container"></div>'
        );
    }

    await test('setupAdvancedToggle returns resetAdvanced fn and starts hidden', () => {
        const deps = advancedFixture();
        try {
            const result = mod.setupAdvancedToggle(deps);
            if (!result || typeof result.resetAdvanced !== 'function') throw new Error('no resetAdvanced');
            const btn = sandbox.querySelector('#toggle-advanced-settings');
            // initial setAdvancedVisibility(false) → data flag false, options hidden
            if (btn.dataset.advancedVisible !== 'false') throw new Error(`flag=${btn.dataset.advancedVisible}`);
            if (!sandbox.querySelector('#daily-options').classList.contains('hidden')) throw new Error('options should start hidden');
            // frequency container always visible
            if (sandbox.querySelector('#recur-frequency-container').classList.contains('hidden')) throw new Error('freq container should be visible');
        } finally { unmount(); }
    });

    await test('Clicking advanced toggle reveals options + sets flag true', () => {
        const deps = advancedFixture();
        try {
            mod.setupAdvancedToggle(deps);
            const btn = sandbox.querySelector('#toggle-advanced-settings');
            fire(btn, 'click');
            if (btn.dataset.advancedVisible !== 'true') throw new Error(`flag=${btn.dataset.advancedVisible}`);
            // active frequency (daily) options shown, others hidden
            if (sandbox.querySelector('#daily-options').classList.contains('hidden')) throw new Error('daily-options should be visible');
            if (!sandbox.querySelector('#weekly-options').classList.contains('hidden')) throw new Error('weekly-options should be hidden');
        } finally { unmount(); }
    });

    await test('resetAdvanced() collapses back to hidden state', () => {
        const deps = advancedFixture();
        try {
            const { resetAdvanced } = mod.setupAdvancedToggle(deps);
            const btn = sandbox.querySelector('#toggle-advanced-settings');
            fire(btn, 'click'); // open
            resetAdvanced();
            if (btn.dataset.advancedVisible !== 'false') throw new Error('flag not reset');
            if (!sandbox.querySelector('#daily-options').classList.contains('hidden')) throw new Error('options should be hidden after reset');
            if (!sandbox.querySelector('#set-default-recurring-container').classList.contains('hidden')) throw new Error('default container should be hidden');
        } finally { unmount(); }
    });

    await test('setupAdvancedToggle returns undefined when toggle missing', () => {
        const deps = mount('<div></div>');
        try {
            const r = mod.setupAdvancedToggle(deps);
            if (r !== undefined) throw new Error(`expected undefined, got ${typeof r}`);
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🕐 setupTimeConversion</h4>';

    function timeFixture(hour, meridiem) {
        return mount(
            `<input id="h" value="${hour}">` +
            '<input id="m" value="0">' +
            `<select id="md"><option value="AM" ${meridiem === 'AM' ? 'selected' : ''}>AM</option>` +
            `<option value="PM" ${meridiem === 'PM' ? 'selected' : ''}>PM</option></select>` +
            '<input type="checkbox" id="mil">'
        );
    }
    const tcConfig = { hourInputId: 'h', minuteInputId: 'm', meridiemSelectId: 'md', militaryCheckboxId: 'mil' };

    await test('12h→24h: 3 PM becomes hour 15 and hides meridiem', () => {
        const deps = timeFixture(3, 'PM');
        try {
            mod.setupTimeConversion(deps, tcConfig);
            const mil = sandbox.querySelector('#mil');
            mil.checked = true;
            fire(mil, 'change');
            if (sandbox.querySelector('#h').value !== '15') throw new Error(`hour=${sandbox.querySelector('#h').value}`);
            if (!sandbox.querySelector('#md').classList.contains('hidden')) throw new Error('meridiem should hide in 24h');
        } finally { unmount(); }
    });

    await test('12h→24h: 12 AM becomes hour 0 (midnight edge)', () => {
        const deps = timeFixture(12, 'AM');
        try {
            mod.setupTimeConversion(deps, tcConfig);
            const mil = sandbox.querySelector('#mil');
            mil.checked = true;
            fire(mil, 'change');
            if (sandbox.querySelector('#h').value !== '0') throw new Error(`hour=${sandbox.querySelector('#h').value}`);
        } finally { unmount(); }
    });

    await test('24h→12h: hour 0 becomes 12 AM and shows meridiem', () => {
        const deps = timeFixture(0, 'AM');
        try {
            mod.setupTimeConversion(deps, tcConfig);
            const mil = sandbox.querySelector('#mil');
            // simulate already-24h state then turning military OFF
            mil.checked = false;
            fire(mil, 'change');
            if (sandbox.querySelector('#h').value !== '12') throw new Error(`hour=${sandbox.querySelector('#h').value}`);
            if (sandbox.querySelector('#md').value !== 'AM') throw new Error(`meridiem=${sandbox.querySelector('#md').value}`);
            if (sandbox.querySelector('#md').classList.contains('hidden')) throw new Error('meridiem should show in 12h');
        } finally { unmount(); }
    });

    await test('setupTimeConversion no-ops when an input is missing', () => {
        const deps = mount('<input id="h"><input id="m">'); // no meridiem/military
        try { mod.setupTimeConversion(deps, tcConfig); } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">↩️ setupTimeInputWrapping</h4>';

    function wrapFixture(is24) {
        return mount(
            '<input id="daily-hour">' +
            '<input id="daily-minute">' +
            `<input type="checkbox" id="daily-military" ${is24 ? 'checked' : ''}>`
        );
    }

    await test('Hour wraps above max 12 → min 1 (12h mode)', () => {
        const deps = wrapFixture(false);
        try {
            mod.setupTimeInputWrapping(deps, 'daily', null);
            const h = sandbox.querySelector('#daily-hour');
            h.value = '13';
            fire(h, 'input');
            if (h.value !== '1') throw new Error(`hour=${h.value}`);
        } finally { unmount(); }
    });

    await test('Hour wraps below min 1 → max 12 (12h mode)', () => {
        const deps = wrapFixture(false);
        try {
            mod.setupTimeInputWrapping(deps, 'daily', null);
            const h = sandbox.querySelector('#daily-hour');
            h.value = '0';
            fire(h, 'input');
            if (h.value !== '12') throw new Error(`hour=${h.value}`);
        } finally { unmount(); }
    });

    await test('Hour wraps above 23 → 0 (24h mode)', () => {
        const deps = wrapFixture(true);
        try {
            mod.setupTimeInputWrapping(deps, 'daily', null);
            const h = sandbox.querySelector('#daily-hour');
            h.value = '24';
            fire(h, 'input');
            if (h.value !== '0') throw new Error(`hour=${h.value}`);
        } finally { unmount(); }
    });

    await test('Minute wraps 60 → 0 and -1 → 59', () => {
        const deps = wrapFixture(false);
        try {
            mod.setupTimeInputWrapping(deps, 'daily', null);
            const m = sandbox.querySelector('#daily-minute');
            m.value = '60'; fire(m, 'input');
            if (m.value !== '0') throw new Error(`min(60)=${m.value}`);
            m.value = '-1'; fire(m, 'input');
            if (m.value !== '59') throw new Error(`min(-1)=${m.value}`);
        } finally { unmount(); }
    });

    await test('Blur clamps out-of-range minute to 59', () => {
        const deps = wrapFixture(false);
        try {
            mod.setupTimeInputWrapping(deps, 'daily', null);
            const m = sandbox.querySelector('#daily-minute');
            m.value = '99';
            // input fires wrap first; set directly then blur to test clamp
            m.value = '99';
            fire(m, 'blur');
            if (m.value !== '59') throw new Error(`clamped=${m.value}`);
        } finally { unmount(); }
    });

    await test('Wrapping invokes onUpdate when value changes', () => {
        const deps = wrapFixture(false);
        let calls = 0;
        try {
            mod.setupTimeInputWrapping(deps, 'daily', () => calls++);
            const h = sandbox.querySelector('#daily-hour');
            h.value = '5'; fire(h, 'input'); // in-range still calls onUpdate
            if (calls < 1) throw new Error('onUpdate not called');
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">⊗ setupMonthlyMutualExclusion</h4>';

    function mutexFixture() {
        return mount(
            '<input type="checkbox" id="monthly-specific-days">' +
            '<input type="checkbox" id="monthly-week-of-month">' +
            '<div id="monthly-week-container"></div>' +
            '<div id="monthly-day-container"></div>'
        );
    }

    await test('Checking specific-days unchecks week-of-month and hides its container', () => {
        const deps = mutexFixture();
        try {
            mod.setupMonthlyMutualExclusion(deps);
            const spec = sandbox.querySelector('#monthly-specific-days');
            const week = sandbox.querySelector('#monthly-week-of-month');
            week.checked = true;
            spec.checked = true;
            fire(spec, 'change');
            if (week.checked) throw new Error('week-of-month should be unchecked');
            if (!sandbox.querySelector('#monthly-week-container').classList.contains('hidden')) throw new Error('week container should hide');
        } finally { unmount(); }
    });

    await test('Checking week-of-month unchecks specific-days and hides day container', () => {
        const deps = mutexFixture();
        try {
            mod.setupMonthlyMutualExclusion(deps);
            const spec = sandbox.querySelector('#monthly-specific-days');
            const week = sandbox.querySelector('#monthly-week-of-month');
            spec.checked = true;
            week.checked = true;
            fire(week, 'change');
            if (spec.checked) throw new Error('specific-days should be unchecked');
            if (!sandbox.querySelector('#monthly-day-container').classList.contains('hidden')) throw new Error('day container should hide');
        } finally { unmount(); }
    });

    await test('setupMonthlyMutualExclusion no-ops when checkboxes missing', () => {
        const deps = mount('<div></div>');
        try { mod.setupMonthlyMutualExclusion(deps); } finally { unmount(); }
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
