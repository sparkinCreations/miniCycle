/**
 * RecurringPanelEvents Tests
 * Tests for modules/recurring/recurringPanelEvents.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelEventsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelEvents.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringPanelEvents Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ------------------------------------------------------------------
    // Sandbox + deps. Delegation handlers are attached via
    // deps.safeAddEventListener to a sandboxed container; we drive them
    // by dispatching real bubbling events at child elements.
    // ------------------------------------------------------------------
    let sandbox;
    function mount(html, extraDeps = {}) {
        sandbox = document.createElement('div');
        sandbox.innerHTML = html;
        document.body.appendChild(sandbox);
        return {
            getElementById: (id) => sandbox.querySelector(`#${CSS.escape(id)}`),
            querySelector: (sel) => sandbox.querySelector(sel),
            querySelectorAll: (sel) => sandbox.querySelectorAll(sel),
            safeAddEventListener: (el, ev, fn, opts) => {
                if (el && el.addEventListener) el.addEventListener(ev, fn, opts);
            },
            ...extraDeps
        };
    }
    function unmount() {
        if (sandbox && sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
        sandbox = null;
    }
    const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const dblclick = (el) => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => { if (!mod) throw new Error('Module is falsy'); });
    await test('initEventDelegation is an exported function', () => {
        if (typeof mod.initEventDelegation !== 'function') throw new Error(`got ${typeof mod.initEventDelegation}`);
    });
    await test('setupMonthlyDayDelegation is an exported function', () => {
        if (typeof mod.setupMonthlyDayDelegation !== 'function') throw new Error(`got ${typeof mod.setupMonthlyDayDelegation}`);
    });
    await test('setupWeeklyDayDelegation is an exported function', () => {
        if (typeof mod.setupWeeklyDayDelegation !== 'function') throw new Error(`got ${typeof mod.setupWeeklyDayDelegation}`);
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ initEventDelegation guard</h4>';

    await test('initEventDelegation returns true first time, false when already init', () => {
        const deps = mount('<div class="monthly-days"></div>');
        try {
            const state = { selectedYearlyDays: {} };
            const cb = { getSelectedYearlyMonths: () => [], handleRemoveTask: () => {}, showTaskSummaryPreview: () => {} };
            const first = mod.initEventDelegation(deps, state, cb);
            const second = mod.initEventDelegation(deps, state, cb);
            if (first !== true) throw new Error(`first=${first}`);
            if (second !== false) throw new Error(`second=${second}`);
            if (state._eventDelegationInitialized !== true) throw new Error('flag not set');
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Monthly day delegation</h4>';

    await test('Clicking a monthly day box toggles .selected + aria-checked', () => {
        const deps = mount(
            '<div class="monthly-days">' +
            '<div class="monthly-day-box" data-day="1" aria-checked="false">1</div>' +
            '</div>'
        );
        try {
            mod.setupMonthlyDayDelegation(deps);
            const box = sandbox.querySelector('.monthly-day-box');
            click(box);
            if (!box.classList.contains('selected')) throw new Error('not selected after click');
            if (box.getAttribute('aria-checked') !== 'true') throw new Error('aria-checked not true');
            click(box);
            if (box.classList.contains('selected')) throw new Error('still selected after 2nd click');
            if (box.getAttribute('aria-checked') !== 'false') throw new Error('aria-checked not false');
        } finally { unmount(); }
    });

    await test('Clicking inside monthly container but not a box does nothing', () => {
        const deps = mount('<div class="monthly-days"><span class="gap">x</span></div>');
        try {
            mod.setupMonthlyDayDelegation(deps);
            click(sandbox.querySelector('.gap')); // should not throw / no boxes to toggle
        } finally { unmount(); }
    });

    await test('Keydown Enter toggles monthly day box', () => {
        const deps = mount(
            '<div class="monthly-days"><div class="monthly-day-box" data-day="2" aria-checked="false">2</div></div>'
        );
        try {
            mod.setupMonthlyDayDelegation(deps);
            const box = sandbox.querySelector('.monthly-day-box');
            box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            if (!box.classList.contains('selected')) throw new Error('Enter did not toggle');
        } finally { unmount(); }
    });

    await test('setupMonthlyDayDelegation no-ops when container missing', () => {
        const deps = mount('<div class="other"></div>');
        try { mod.setupMonthlyDayDelegation(deps); } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📆 Weekly day delegation</h4>';

    await test('Clicking a weekly day box toggles selection', () => {
        const deps = mount(
            '<div class="weekly-days"><div class="weekly-day-box" data-day="Mon" aria-checked="false">Mon</div></div>'
        );
        try {
            mod.setupWeeklyDayDelegation(deps);
            const box = sandbox.querySelector('.weekly-day-box');
            click(box);
            if (!box.classList.contains('selected')) throw new Error('not selected');
            if (box.getAttribute('aria-checked') !== 'true') throw new Error('aria not synced');
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🗓️ Yearly month delegation</h4>';

    function yearlyMonthFixture(selectedMonths) {
        const deps = mount(
            '<div class="yearly-months"><div class="yearly-month-box" data-month="3" aria-checked="false">Mar</div></div>' +
            '<label id="yearly-specific-days-label" class="hidden"></label>' +
            '<label id="yearly-apply-all-label" class="hidden"></label>' +
            '<input type="checkbox" id="yearly-specific-days">' +
            '<div id="yearly-day-container" class="hidden"></div>' +
            '<select id="yearly-month-select"></select>'
        );
        const state = { selectedYearlyDays: {} };
        const cb = { getSelectedYearlyMonths: () => selectedMonths };
        return { deps, state, cb };
    }

    await test('Selecting a month reveals specific-days label + populates dropdown', () => {
        const { deps, state, cb } = yearlyMonthFixture([3]);
        try {
            mod.setupYearlyMonthDelegation(deps, state, cb);
            click(sandbox.querySelector('.yearly-month-box'));
            if (sandbox.querySelector('#yearly-specific-days-label').classList.contains('hidden')) {
                throw new Error('specific-days label should be revealed');
            }
            const opts = sandbox.querySelectorAll('#yearly-month-select option');
            if (opts.length !== 1 || opts[0].value !== '3') throw new Error(`dropdown=${opts.length}`);
        } finally { unmount(); }
    });

    await test('Deselecting all months hides specific-days label', () => {
        const { deps, state, cb } = yearlyMonthFixture([]);
        try {
            mod.setupYearlyMonthDelegation(deps, state, cb);
            click(sandbox.querySelector('.yearly-month-box'));
            if (!sandbox.querySelector('#yearly-specific-days-label').classList.contains('hidden')) {
                throw new Error('label should be hidden with zero months');
            }
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📌 Yearly day delegation (state mutation)</h4>';

    function yearlyDayFixture(applyAll) {
        const deps = mount(
            '<div id="yearly-day-container">' +
            '<div class="yearly-day-box" data-day="5" aria-checked="false">5</div>' +
            '</div>' +
            `<input type="checkbox" id="yearly-apply-all" ${applyAll ? 'checked' : ''}>` +
            '<select id="yearly-month-select"><option value="3" selected>Mar</option></select>'
        );
        return deps;
    }

    await test('Selecting a yearly day adds it to per-month state', () => {
        const deps = yearlyDayFixture(false);
        try {
            const state = { selectedYearlyDays: {} };
            const cb = { getSelectedYearlyMonths: () => [3] };
            mod.setupYearlyDayDelegation(deps, state, cb);
            click(sandbox.querySelector('.yearly-day-box'));
            if (JSON.stringify(state.selectedYearlyDays[3]) !== JSON.stringify([5])) {
                throw new Error(`state=${JSON.stringify(state.selectedYearlyDays)}`);
            }
        } finally { unmount(); }
    });

    await test('Deselecting a yearly day removes it from per-month state', () => {
        const deps = yearlyDayFixture(false);
        try {
            const state = { selectedYearlyDays: { 3: [5] } };
            const cb = { getSelectedYearlyMonths: () => [3] };
            // Pre-mark the box as selected so the first click deselects it.
            sandbox.querySelector('.yearly-day-box').classList.add('selected');
            mod.setupYearlyDayDelegation(deps, state, cb);
            click(sandbox.querySelector('.yearly-day-box'));
            if (JSON.stringify(state.selectedYearlyDays[3]) !== JSON.stringify([])) {
                throw new Error(`state=${JSON.stringify(state.selectedYearlyDays)}`);
            }
        } finally { unmount(); }
    });

    await test('apply-to-all writes shared "all" list AND syncs active months', () => {
        const deps = yearlyDayFixture(true);
        try {
            const state = { selectedYearlyDays: {} };
            const cb = { getSelectedYearlyMonths: () => [3, 6] };
            mod.setupYearlyDayDelegation(deps, state, cb);
            click(sandbox.querySelector('.yearly-day-box'));
            if (JSON.stringify(state.selectedYearlyDays.all) !== JSON.stringify([5])) throw new Error(`all=${JSON.stringify(state.selectedYearlyDays.all)}`);
            if (JSON.stringify(state.selectedYearlyDays[3]) !== JSON.stringify([5])) throw new Error('month 3 not synced');
            if (JSON.stringify(state.selectedYearlyDays[6]) !== JSON.stringify([5])) throw new Error('month 6 not synced');
        } finally { unmount(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Task list delegation</h4>';

    function makeAppState(template) {
        return {
            isReady: () => true,
            get: () => ({
                appState: { activeCycleId: 'c1' },
                data: { cycles: { c1: { recurringTemplates: template ? { 't1': template } : {} } } }
            })
        };
    }

    function taskListFixture(appState) {
        return mount(
            '<div id="recurring-task-list">' +
            '<div class="recurring-task-item" data-task-id="t1" aria-selected="false">' +
            '<input type="checkbox" class="recurring-check">' +
            '<button class="recurring-remove-btn">x</button>' +
            '<span class="label">Task</span>' +
            '</div></div>',
            { AppState: appState }
        );
    }

    await test('Clicking a task checkbox toggles item .checked and stops there', () => {
        const deps = taskListFixture(makeAppState({ id: 't1' }));
        try {
            const state = {};
            const cb = {};
            mod.setupTaskListDelegation(deps, state, cb);
            const item = sandbox.querySelector('.recurring-task-item');
            click(sandbox.querySelector('.recurring-check'));
            if (!item.classList.contains('checked')) throw new Error('item not checked');
            // checkbox path returns early → should NOT have selected the item
            if (item.classList.contains('selected')) throw new Error('should not select on checkbox click');
        } finally { unmount(); }
    });

    await test('Clicking remove button calls handleRemoveTask with template + item', () => {
        const template = { id: 't1', taskText: 'Hi' };
        const deps = taskListFixture(makeAppState(template));
        try {
            let received = null;
            const cb = { handleRemoveTask: (tpl, el) => { received = { tpl, el }; } };
            mod.setupTaskListDelegation(deps, {}, cb);
            click(sandbox.querySelector('.recurring-remove-btn'));
            if (!received) throw new Error('handleRemoveTask not called');
            if (received.tpl !== template) throw new Error('wrong template passed');
            if (received.el !== sandbox.querySelector('.recurring-task-item')) throw new Error('wrong item passed');
        } finally { unmount(); }
    });

    await test('Clicking row selects item + shows summary preview from template', () => {
        const template = { id: 't1', taskText: 'Hi' };
        const deps = taskListFixture(makeAppState(template));
        try {
            let previewed = null;
            const state = {};
            const cb = {
                showTaskSummaryPreview: (tpl) => { previewed = tpl; },
                getPanelMode: () => 'previewing',
                setPanelMode: () => {}
            };
            mod.setupTaskListDelegation(deps, state, cb);
            click(sandbox.querySelector('.label'));
            const item = sandbox.querySelector('.recurring-task-item');
            if (!item.classList.contains('selected')) throw new Error('item not selected');
            if (item.getAttribute('aria-selected') !== 'true') throw new Error('aria-selected not true');
            if (state.selectedTaskId !== 't1') throw new Error(`selectedTaskId=${state.selectedTaskId}`);
            if (previewed !== template) throw new Error('summary preview not shown with template');
        } finally { unmount(); }
    });

    await test('Row click transitions to previewing when not already editing', () => {
        const deps = taskListFixture(makeAppState({ id: 't1' }));
        try {
            let mode = null;
            const cb = {
                showTaskSummaryPreview: () => {},
                getPanelMode: () => 'browsing',
                setPanelMode: (m) => { mode = m; }
            };
            mod.setupTaskListDelegation(deps, {}, cb);
            click(sandbox.querySelector('.label'));
            if (mode !== 'previewing') throw new Error(`setPanelMode got ${mode}`);
        } finally { unmount(); }
    });

    await test('Double-click toggles item checked + syncs checkbox', () => {
        const deps = taskListFixture(makeAppState({ id: 't1' }));
        try {
            mod.setupTaskListDelegation(deps, {}, {});
            const item = sandbox.querySelector('.recurring-task-item');
            dblclick(sandbox.querySelector('.label'));
            if (!item.classList.contains('checked')) throw new Error('not checked after dblclick');
            if (sandbox.querySelector('.recurring-check').checked !== true) throw new Error('checkbox not synced');
        } finally { unmount(); }
    });

    await test('setupTaskListDelegation no-ops when list missing', () => {
        const deps = mount('<div></div>', { AppState: makeAppState(null) });
        try { mod.setupTaskListDelegation(deps, {}, {}); } finally { unmount(); }
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
