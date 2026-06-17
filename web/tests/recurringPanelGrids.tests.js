/**
 * RecurringPanelGrids Tests
 * Tests for modules/recurring/recurringPanelGrids.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runRecurringPanelGridsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/recurring/recurringPanelGrids.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>RecurringPanelGrids Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ------------------------------------------------------------------
    // DOM fixture helpers
    // ------------------------------------------------------------------
    // The grid generators select their target via class selectors
    // (.monthly-days / .yearly-months / .yearly-days). We mount a sandbox
    // and provide deps.querySelector / deps.getElementById scoped to it.
    let sandbox;

    function mountSandbox(html) {
        sandbox = document.createElement('div');
        sandbox.innerHTML = html;
        document.body.appendChild(sandbox);
        return {
            querySelector: (sel) => sandbox.querySelector(sel),
            getElementById: (id) => sandbox.querySelector(`#${id}`)
        };
    }

    function cleanupSandbox() {
        if (sandbox && sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
        sandbox = null;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('generateMonthlyDayGrid is an exported function', () => {
        if (typeof mod.generateMonthlyDayGrid !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.generateMonthlyDayGrid}`);
        }
    });

    await test('generateYearlyMonthGrid is an exported function', () => {
        if (typeof mod.generateYearlyMonthGrid !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.generateYearlyMonthGrid}`);
        }
    });

    await test('generateYearlyDayGrid is an exported function', () => {
        if (typeof mod.generateYearlyDayGrid !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.generateYearlyDayGrid}`);
        }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📅 generateMonthlyDayGrid</h4>';

    await test('generateMonthlyDayGrid builds exactly 31 day boxes', () => {
        const deps = mountSandbox('<div class="monthly-days"></div>');
        try {
            mod.generateMonthlyDayGrid(deps);
            const boxes = sandbox.querySelectorAll('.monthly-day-box');
            if (boxes.length !== 31) throw new Error(`Expected 31 boxes, got ${boxes.length}`);
        } finally { cleanupSandbox(); }
    });

    await test('Monthly boxes carry correct data-day + textContent 1..31', () => {
        const deps = mountSandbox('<div class="monthly-days"></div>');
        try {
            mod.generateMonthlyDayGrid(deps);
            const boxes = sandbox.querySelectorAll('.monthly-day-box');
            const first = boxes[0], last = boxes[30];
            if (first.getAttribute('data-day') !== '1') throw new Error(`first data-day=${first.getAttribute('data-day')}`);
            if (first.textContent !== '1') throw new Error(`first text=${first.textContent}`);
            if (last.getAttribute('data-day') !== '31') throw new Error(`last data-day=${last.getAttribute('data-day')}`);
            if (last.textContent !== '31') throw new Error(`last text=${last.textContent}`);
        } finally { cleanupSandbox(); }
    });

    await test('Monthly boxes have role=checkbox and aria-checked=false', () => {
        const deps = mountSandbox('<div class="monthly-days"></div>');
        try {
            mod.generateMonthlyDayGrid(deps);
            const box = sandbox.querySelector('.monthly-day-box');
            if (box.getAttribute('role') !== 'checkbox') throw new Error(`role=${box.getAttribute('role')}`);
            if (box.getAttribute('aria-checked') !== 'false') throw new Error(`aria-checked=${box.getAttribute('aria-checked')}`);
            if (!box.getAttribute('aria-label')) throw new Error('missing aria-label');
        } finally { cleanupSandbox(); }
    });

    await test('Monthly grid roving tabindex: first 0, rest -1', () => {
        const deps = mountSandbox('<div class="monthly-days"></div>');
        try {
            mod.generateMonthlyDayGrid(deps);
            const boxes = sandbox.querySelectorAll('.monthly-day-box');
            if (boxes[0].getAttribute('tabindex') !== '0') throw new Error(`first tabindex=${boxes[0].getAttribute('tabindex')}`);
            if (boxes[1].getAttribute('tabindex') !== '-1') throw new Error(`second tabindex=${boxes[1].getAttribute('tabindex')}`);
        } finally { cleanupSandbox(); }
    });

    await test('Monthly grid clears prior content before rebuild (idempotent)', () => {
        const deps = mountSandbox('<div class="monthly-days"><span class="stale">x</span></div>');
        try {
            mod.generateMonthlyDayGrid(deps);
            mod.generateMonthlyDayGrid(deps);
            if (sandbox.querySelector('.stale')) throw new Error('stale content not cleared');
            const boxes = sandbox.querySelectorAll('.monthly-day-box');
            if (boxes.length !== 31) throw new Error(`Expected 31 after double-build, got ${boxes.length}`);
        } finally { cleanupSandbox(); }
    });

    await test('generateMonthlyDayGrid no-ops when container missing', () => {
        const deps = mountSandbox('<div class="other"></div>');
        try {
            mod.generateMonthlyDayGrid(deps); // should not throw
            if (sandbox.querySelector('.monthly-day-box')) throw new Error('created boxes without container');
        } finally { cleanupSandbox(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">📆 generateYearlyMonthGrid</h4>';

    await test('generateYearlyMonthGrid builds exactly 12 month boxes', () => {
        const deps = mountSandbox('<div class="yearly-months"></div>');
        try {
            mod.generateYearlyMonthGrid(deps);
            const boxes = sandbox.querySelectorAll('.yearly-month-box');
            if (boxes.length !== 12) throw new Error(`Expected 12, got ${boxes.length}`);
        } finally { cleanupSandbox(); }
    });

    await test('Yearly month boxes carry data-month 1..12', () => {
        const deps = mountSandbox('<div class="yearly-months"></div>');
        try {
            mod.generateYearlyMonthGrid(deps);
            const boxes = sandbox.querySelectorAll('.yearly-month-box');
            if (boxes[0].getAttribute('data-month') !== '1') throw new Error(`first=${boxes[0].getAttribute('data-month')}`);
            if (boxes[11].getAttribute('data-month') !== '12') throw new Error(`last=${boxes[11].getAttribute('data-month')}`);
        } finally { cleanupSandbox(); }
    });

    await test('Yearly month boxes use localized short month names', () => {
        const deps = mountSandbox('<div class="yearly-months"></div>');
        try {
            mod.generateYearlyMonthGrid(deps);
            const boxes = sandbox.querySelectorAll('.yearly-month-box');
            const expectedJan = new Date(0, 0).toLocaleString(undefined, { month: 'short' });
            if (boxes[0].textContent !== expectedJan) throw new Error(`Jan text=${boxes[0].textContent} expected ${expectedJan}`);
            // aria-label mirrors the visible name
            if (boxes[0].getAttribute('aria-label') !== expectedJan) throw new Error('aria-label mismatch');
        } finally { cleanupSandbox(); }
    });

    await test('Yearly month grid roving tabindex: first 0, rest -1', () => {
        const deps = mountSandbox('<div class="yearly-months"></div>');
        try {
            mod.generateYearlyMonthGrid(deps);
            const boxes = sandbox.querySelectorAll('.yearly-month-box');
            if (boxes[0].getAttribute('tabindex') !== '0') throw new Error(`first=${boxes[0].getAttribute('tabindex')}`);
            if (boxes[5].getAttribute('tabindex') !== '-1') throw new Error(`mid=${boxes[5].getAttribute('tabindex')}`);
        } finally { cleanupSandbox(); }
    });

    await test('generateYearlyMonthGrid no-ops when container missing', () => {
        const deps = mountSandbox('<div class="nope"></div>');
        try {
            mod.generateYearlyMonthGrid(deps);
            if (sandbox.querySelector('.yearly-month-box')) throw new Error('created boxes without container');
        } finally { cleanupSandbox(); }
    });

    // ------------------------------------------------------------------
    resultsDiv.innerHTML += '<h4 class="test-section">🗓️ generateYearlyDayGrid</h4>';

    await test('generateYearlyDayGrid builds correct day count for 31-day month (Jan=1)', () => {
        const deps = mountSandbox('<div class="yearly-days"></div>');
        try {
            const state = { selectedYearlyDays: {} };
            mod.generateYearlyDayGrid(deps, state, 1); // January -> 31 days
            const boxes = sandbox.querySelectorAll('.yearly-day-box');
            if (boxes.length !== 31) throw new Error(`Jan expected 31, got ${boxes.length}`);
        } finally { cleanupSandbox(); }
    });

    await test('generateYearlyDayGrid builds 30 days for April (month=4)', () => {
        const deps = mountSandbox('<div class="yearly-days"></div>');
        try {
            const state = { selectedYearlyDays: {} };
            mod.generateYearlyDayGrid(deps, state, 4); // April -> 30 days
            const boxes = sandbox.querySelectorAll('.yearly-day-box');
            if (boxes.length !== 30) throw new Error(`Apr expected 30, got ${boxes.length}`);
        } finally { cleanupSandbox(); }
    });

    await test('generateYearlyDayGrid marks selected days from per-month state', () => {
        const deps = mountSandbox('<div class="yearly-days"></div>');
        try {
            const state = { selectedYearlyDays: { 1: [5, 10] } };
            mod.generateYearlyDayGrid(deps, state, 1);
            const boxes = Array.from(sandbox.querySelectorAll('.yearly-day-box'));
            const day5 = boxes.find(b => b.dataset.day === '5');
            const day10 = boxes.find(b => b.dataset.day === '10');
            const day6 = boxes.find(b => b.dataset.day === '6');
            if (!day5.classList.contains('selected')) throw new Error('day5 not selected');
            if (!day10.classList.contains('selected')) throw new Error('day10 not selected');
            if (day6.classList.contains('selected')) throw new Error('day6 wrongly selected');
            if (day5.getAttribute('aria-checked') !== 'true') throw new Error('day5 aria-checked not true');
            if (day6.getAttribute('aria-checked') !== 'false') throw new Error('day6 aria-checked not false');
        } finally { cleanupSandbox(); }
    });

    await test('generateYearlyDayGrid uses shared "all" days when apply-to-all checked', () => {
        const deps = mountSandbox(
            '<div class="yearly-days"></div>' +
            '<input type="checkbox" id="yearly-apply-days-to-all" checked>'
        );
        try {
            // Per-month state says day 3 selected, shared "all" says day 7 selected.
            // With apply-to-all ON, only the shared list should drive selection.
            const state = { selectedYearlyDays: { 1: [3], all: [7] } };
            mod.generateYearlyDayGrid(deps, state, 1);
            const boxes = Array.from(sandbox.querySelectorAll('.yearly-day-box'));
            const day7 = boxes.find(b => b.dataset.day === '7');
            const day3 = boxes.find(b => b.dataset.day === '3');
            if (!day7.classList.contains('selected')) throw new Error('shared day7 not selected under apply-all');
            if (day3.classList.contains('selected')) throw new Error('per-month day3 should be ignored under apply-all');
        } finally { cleanupSandbox(); }
    });

    await test('generateYearlyDayGrid no-ops when container missing', () => {
        const deps = mountSandbox('<div class="missing"></div>');
        try {
            const state = { selectedYearlyDays: {} };
            mod.generateYearlyDayGrid(deps, state, 1);
            if (sandbox.querySelector('.yearly-day-box')) throw new Error('created boxes without container');
        } finally { cleanupSandbox(); }
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
